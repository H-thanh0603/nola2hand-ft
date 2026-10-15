// Disputes: tranh chấp & hoàn tiền — buyer mở, admin tài chính xử lý
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult, genDisputeCode, pushTimeline, notify, applyWallet } = require('../utils');
const { httpUrl } = require('../validators');

const router = express.Router();

// POST /api/v1/orders/:id/disputes — người mua mở tranh chấp
router.post(
  '/orders/:id/disputes',
  auth,
  validate(z.object({
    reason: z.string().trim().min(1).max(200),
    description: z.string().trim().min(10).max(2000),
    evidences: z.array(httpUrl('Ảnh bằng chứng')).max(5).optional(),
  })),
  asyncHandler(async (req, res) => {
    await require('../services/evidence').assertOwnEvidence(req.body.evidences,req.user.id);
    const order = await prisma.order.findUnique({
      where: { id: +req.params.id },
      include: { dispute: true },
    });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    if (order.buyerId !== req.user.id)
      return res.status(403).json({ message: 'Chỉ người mua mở tranh chấp được' });
    if (!['SHIPPING', 'DELIVERED', 'DEPOSITED', 'CONFIRMED'].includes(order.status))
      return res.status(400).json({ message: `Không thể mở tranh chấp ở trạng thái ${order.status}` });
    if (order.dispute) return res.status(400).json({ message: 'Đơn này đã có tranh chấp' });

    const dispute = await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: 'DISPUTED' } });
      if (!moved.count) throw Object.assign(new Error('Đơn đã đổi trạng thái, hãy tải lại'), { status: 409 });
      const returning = await tx.returnRequest.findUnique({ where: { orderId: order.id } });
      if (returning && !['REJECTED','CANCELLED'].includes(returning.status)) throw Object.assign(new Error('Đơn đang có yêu cầu trả hàng'), { status: 409 });
      const held = await tx.escrow.findUnique({ where: { orderId: order.id } });
      const d = await tx.dispute.create({
        data: {
          code: genDisputeCode(),
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          reason: req.body.reason,
          description: req.body.description,
          amount: held?.status === 'HELD' ? held.amount : 0,
          evidences: req.body.evidences
            ? { create: req.body.evidences.map((url) => ({ url })) } : undefined,
        },
      });
      await pushTimeline(tx, order.id, 'DISPUTED', `Mở tranh chấp ${d.code}: ${req.body.reason}`);
      return d;
    });

    // Báo cho admin tài chính
    const admins = await prisma.user.findMany({
      where: { roles: { some: { role: { name: 'ADMIN_FINANCE' } } }, status: 'ACTIVE' },
      select: { id: true },
    });
    for (const a of admins)
      await notify(null, a.id, 'DISPUTE', 'Tranh chấp mới cần xử lý',
        `${dispute.code} — đơn ${order.code}: ${req.body.reason}`, { disputeId: dispute.id });

    res.status(201).json({ message: 'Đã mở tranh chấp, admin sẽ xem xét trong 24h', dispute });
  })
);

// GET /api/v1/disputes/mine — tranh chấp của tôi
router.get('/mine', auth, asyncHandler(async (req, res) => {
  res.json(await prisma.dispute.findMany({
    where: { OR: [{ buyerId: req.user.id }, { sellerId: req.user.id }] },
    include: { order: { select: { code: true } }, evidences: true },
    orderBy: { createdAt: 'desc' },
  }));
}));

// GET /api/v1/admin/disputes — danh sách (admin tài chính)
router.get('/admin/all', auth, requireRole('ADMIN_FINANCE'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.q) where.OR = [{ code: { contains: req.query.q, mode: 'insensitive' } }, { reason: { contains: req.query.q, mode: 'insensitive' } }, { order: { code: { contains: req.query.q, mode: 'insensitive' } } }];
  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      include: {
        buyer: { select: { id: true, fullName: true } },
        seller: { select: { id: true, fullName: true } },
        order: { select: { code: true } },
        evidences: true,
      },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.dispute.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

// PATCH /api/v1/disputes/admin/:id/resolve — xử lý tranh chấp:
//   BUYER_WINS  -> hoàn toàn bộ cọc cho buyer
//   SELLER_WINS -> giải ngân cọc cho seller (đơn COMPLETED)
//   SPLIT       -> chia đôi cọc
//   REJECT      -> bác khiếu nại, đơn quay lại SHIPPING
router.patch(
  '/admin/:id/resolve',
  auth,
  requireRole('ADMIN_FINANCE'),
  validate(z.object({
    decision: z.enum(['BUYER_WINS', 'SELLER_WINS', 'SPLIT', 'REFUND_BUYER', 'REJECT']),
    resolution: z.string().trim().min(1).max(1000),
  })),
  asyncHandler(async (req, res) => {
    const dispute = await prisma.dispute.findUnique({
      where: { id: +req.params.id },
      include: { order: { include: { escrow: true } } },
    });
    if (!dispute) return res.status(404).json({ message: 'Không tìm thấy tranh chấp' });
    if (!['OPEN', 'REVIEWING'].includes(dispute.status))
      return res.status(400).json({ message: 'Tranh chấp đã được xử lý' });

    let { decision, resolution } = req.body;
    if (decision === 'REFUND_BUYER') decision = 'BUYER_WINS'; // tương thích ngược
    const order = dispute.order;
    const escrow = order.escrow;

    await prisma.$transaction(async (tx) => {
      const locked = await tx.order.updateMany({ where: { id: order.id, status: 'DISPUTED' }, data: { status: 'DISPUTED' } });
      if (!locked.count) throw Object.assign(new Error('Đơn không còn ở trạng thái tranh chấp'), { status: 409 });
      const claimed = await tx.dispute.updateMany({ where: { id: dispute.id, status: { in: ['OPEN', 'REVIEWING'] } }, data: { status: decision === 'REJECT' ? 'REJECTED' : decision === 'SELLER_WINS' ? 'CLOSED' : 'REFUNDED', resolution } });
      if (!claimed.count) throw Object.assign(new Error('Tranh chấp đã được xử lý'), { status: 409 });
      if (decision === 'BUYER_WINS') {
        if (escrow && escrow.status === 'HELD') {
          await tx.escrow.update({ where: { id: escrow.id }, data: { status: 'REFUNDED', releasedAt: new Date() } });
          await applyWallet(tx, dispute.buyerId, 'REFUND', escrow.amount, order.code, `Hoàn tiền tranh chấp ${dispute.code}`);
        }
        await tx.order.update({ where: { id: dispute.orderId }, data: { status: 'REFUNDED' } });
        await pushTimeline(tx, dispute.orderId, 'REFUNDED', `Hoàn tiền theo ${dispute.code}: ${resolution}`);
      } else if (decision === 'SELLER_WINS') {
        if (escrow && escrow.status === 'HELD') {
          const released = await tx.escrow.updateMany({
            where: { id: escrow.id, status: 'HELD' },
            data: { status: 'RELEASED', releasedAt: new Date() },
          });
          if (released.count) {
            const platformFee = Math.min(order.platformFee, escrow.amount);
            const sellerIncome = escrow.amount;
            if (sellerIncome) await applyWallet(tx, order.sellerId, 'ORDER_INCOME', sellerIncome, order.code, `Tiền cọc đơn ${order.code} (thắng tranh chấp)`);
            if (platformFee) await applyWallet(tx, order.sellerId, 'PLATFORM_FEE', -platformFee, order.code, `Phí sàn đơn ${order.code}`);
            await tx.listing.update({ where: { id: order.listingId }, data: { status: 'SOLD_OUT' } });
          }
        }
        await tx.order.update({ where: { id: dispute.orderId }, data: { status: 'COMPLETED' } });
        await pushTimeline(tx, dispute.orderId, 'COMPLETED', `Tranh chấp ${dispute.code}: xử thắng cho người bán`);
      } else if (decision === 'SPLIT') {
        if (escrow && escrow.status === 'HELD') {
          await tx.escrow.update({ where: { id: escrow.id }, data: { status: 'REFUNDED', releasedAt: new Date() } });
          const buyerHalf = Math.ceil(escrow.amount / 2);
          const sellerHalf = escrow.amount - buyerHalf;
          const fee = Math.min(sellerHalf, Math.floor(order.platformFee / 2));
          await applyWallet(tx, dispute.buyerId, 'REFUND', buyerHalf, order.code, `Hoàn 50% tranh chấp ${dispute.code}`);
          if (sellerHalf > 0)
            await applyWallet(tx, order.sellerId, 'ORDER_INCOME', sellerHalf, order.code, `Nhận 50% tranh chấp ${dispute.code}`);
          if (fee) await applyWallet(tx, order.sellerId, 'PLATFORM_FEE', -fee, order.code, `Phí sàn tranh chấp ${dispute.code}`);
        }
        await tx.order.update({ where: { id: dispute.orderId }, data: { status: 'REFUNDED' } });
        await pushTimeline(tx, dispute.orderId, 'REFUNDED', `Chia đôi theo ${dispute.code}: ${resolution}`);
      } else {
        await tx.order.update({ where: { id: dispute.orderId }, data: { status: 'SHIPPING' } });
        await pushTimeline(tx, dispute.orderId, 'SHIPPING', `Từ chối khiếu nại ${dispute.code}: ${resolution}`);
      }
      if (['BUYER_WINS', 'SPLIT'].includes(decision)) await tx.listing.updateMany({ where: { id: order.listingId, status: 'RESERVED' }, data: { status: 'HIDDEN' } });
      await tx.auditLog.create({
        data: {
          adminId: req.user.id, action: 'RESOLVE_DISPUTE',
          target: `dispute:${dispute.code}`, detail: { decision, resolution },
        },
      });
    });

    const buyerMsg = {
      BUYER_WINS: `Bạn thắng tranh chấp — đã hoàn ${dispute.amount.toLocaleString('vi-VN')}đ về ví`,
      SELLER_WINS: 'Người bán thắng tranh chấp — tiền cọc đã được giải ngân cho shop',
      SPLIT: 'Tranh chấp được chia đôi — bạn nhận lại 50% tiền cọc',
      REJECT: 'Khiếu nại của bạn đã bị từ chối',
    }[decision];
    await notify(null, dispute.buyerId, 'DISPUTE', `Kết quả ${dispute.code}`, buyerMsg, { disputeId: dispute.id });
    await notify(null, dispute.sellerId, 'DISPUTE', `Kết quả ${dispute.code}`, resolution, { disputeId: dispute.id });
    res.json({ message: 'Đã xử lý tranh chấp' });
  })
);

module.exports = router;
