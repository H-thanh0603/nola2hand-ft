// Escrow (SafePay): đặt cọc giữ hộ — giữ tiền, giải ngân, hoàn cọc
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, validate } = require('../middleware');
const { pushTimeline, notify, applyWallet } = require('../utils');

const router = express.Router();

// POST /api/v1/orders/:id/deposit — người mua đặt cọc (mặc định 20%, tối thiểu 10%)
router.post(
  '/orders/:id/deposit',
  auth,
  validate(z.object({
    amount: z.number().int().min(1).optional(), // không gửi = 20% giá
    paymentMethod: z.enum(['MOMO_QR', 'SAFEPAY_WALLET', 'BANK_TRANSFER', 'NAPAS']).default('SAFEPAY_WALLET'),
  })),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: +req.params.id } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    if (order.buyerId !== req.user.id)
      return res.status(403).json({ message: 'Chỉ người mua đặt cọc được' });
    if (order.status !== 'PENDING_DEPOSIT')
      return res.status(400).json({ message: `Đơn đang ở trạng thái ${order.status}` });
    if (req.body.paymentMethod !== 'SAFEPAY_WALLET')
      return res.status(400).json({ message: 'Thanh toán qua cổng ngoài chưa được tích hợp webhook xác minh' });

    const minDeposit = Math.ceil((order.totalAmount * 10) / 100);
    const amount = req.body.amount || Math.ceil((order.totalAmount * 20) / 100);
    if (amount < minDeposit)
      return res.status(400).json({ message: `Tiền cọc tối thiểu ${minDeposit.toLocaleString('vi-VN')}đ (10%)` });
    if (amount > order.totalAmount)
      return res.status(400).json({ message: 'Tiền cọc không vượt quá giá trị đơn' });

    const result = await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING_DEPOSIT', OR: [{ reservationExpiresAt: null }, { reservationExpiresAt: { gt: new Date() } }] },
        data: { status: 'DEPOSITED', depositAmount: amount, remainingAmount: order.totalAmount - amount, paymentMethod: req.body.paymentMethod },
      });
      if (!moved.count) throw Object.assign(new Error('Đơn đã hết hạn giữ món hoặc đã được xử lý'), { status: 409 });
      await applyWallet(tx, req.user.id, 'ORDER_PAYMENT', -amount, order.code, `Đặt cọc đơn ${order.code}`);
      const escrow = await tx.escrow.create({
        data: { orderId: order.id, amount, status: 'HELD' },
      });
      const o = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'DEPOSITED',
          depositAmount: amount,
          remainingAmount: order.totalAmount - amount,
          paymentMethod: req.body.paymentMethod,
        },
        include: { escrow: true },
      });
      await pushTimeline(tx, o.id, 'DEPOSITED', `Đã đặt cọc ${amount.toLocaleString('vi-VN')}đ qua SafePay`);
      return { order: o, escrow };
    });

    await notify(null, order.sellerId, 'ESCROW', 'Người mua đã đặt cọc',
      `Đơn ${order.code} đã cọc ${amount.toLocaleString('vi-VN')}đ — hãy chuẩn bị gửi hàng`, { orderId: order.id });
    res.status(201).json({ message: 'Đặt cọc thành công, tiền được SafePay giữ hộ', ...result });
  })
);

// POST /api/v1/escrow/:id/refund — hoàn cọc (khi seller huỷ / hàng sai mô tả, do admin tài chính duyệt)
router.post(
  '/:id/refund',
  auth,
  validate(z.object({ reason: z.string().trim().min(1).max(500) })),
  asyncHandler(async (req, res) => {
    const escrow = await prisma.escrow.findUnique({
      where: { id: +req.params.id },
      include: { order: true },
    });
    if (!escrow) return res.status(404).json({ message: 'Không tìm thấy khoản ký quỹ' });
    if (escrow.status !== 'HELD')
      return res.status(400).json({ message: `Khoản ký quỹ đang ở trạng thái ${escrow.status}` });

    const isAdmin = req.user.roles.includes('ADMIN_FINANCE');
    const isSellerCancel = req.user.id === escrow.order.sellerId;
    if (!isAdmin && !isSellerCancel)
      return res.status(403).json({ message: 'Không có quyền hoàn cọc' });

    const refundedAmount = await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: escrow.orderId, status: { in: ['DEPOSITED', 'CONFIRMED', 'SHIPPING', ...(isAdmin ? ['DISPUTED'] : [])] } },
        data: { status: 'REFUNDED' },
      });
      if (!moved.count) throw Object.assign(new Error('Đơn không còn được phép hoàn tiền'), { status: 409 });
      const returning = await tx.returnRequest.findUnique({ where: { orderId: escrow.orderId } });
      if (returning && !['REJECTED','CANCELLED'].includes(returning.status)) throw Object.assign(new Error('Phải hoàn tiền qua tiến trình trả hàng'), { status: 409 });
      const current = await tx.escrow.findUnique({ where: { id: escrow.id } });
      if (!current || current.status !== 'HELD') throw Object.assign(new Error('Khoản ký quỹ không còn khả dụng'), { status: 409 });
      const refunded = await tx.escrow.updateMany({
        where: { id: escrow.id, status: 'HELD' },
        data: { status: 'REFUNDED', releasedAt: new Date() },
      });
      if (!refunded.count) {
        const e = new Error('Khoản ký quỹ vừa được xử lý, vui lòng tải lại');
        e.status = 409;
        throw e;
      }
      await applyWallet(tx, escrow.order.buyerId, 'REFUND', current.amount, escrow.order.code, `Hoàn cọc: ${req.body.reason}`);
      await tx.listing.updateMany({ where: { id: escrow.order.listingId, status: 'RESERVED' }, data: { status: escrow.order.status === 'SHIPPING' ? 'HIDDEN' : 'ACTIVE' } });
      await pushTimeline(tx, escrow.orderId, 'REFUNDED', `Hoàn cọc: ${req.body.reason}`);
      await notify(tx, escrow.order.buyerId, 'ESCROW', 'Đã hoàn tiền cọc', `${current.amount.toLocaleString('vi-VN')}đ đã được hoàn về ví`, { orderId: escrow.orderId });
      return current.amount;
    });
    res.json({ message: 'Hoàn cọc thành công', refundedAmount });
  })
);

// GET /api/v1/escrow/mine — các khoản ký quỹ liên quan tới tôi
router.get('/mine', auth, asyncHandler(async (req, res) => {
  const escrows = await prisma.escrow.findMany({
    where: { order: { OR: [{ buyerId: req.user.id }, { sellerId: req.user.id }] } },
    include: { order: { select: { code: true, priceAgreed: true, status: true } } },
    orderBy: { heldAt: 'desc' },
  });
  res.json(escrows);
}));

router.post('/orders/:id/pay-remainder', auth, asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: +req.params.id } });
  if (!order || order.buyerId !== req.user.id) return res.status(404).json({ message: 'Không tìm thấy đơn mua' });
  if (!['DEPOSITED', 'CONFIRMED', 'SHIPPING', 'DELIVERED'].includes(order.status) || order.remainingAmount <= 0)
    return res.status(400).json({ message: 'Đơn không còn khoản thanh toán khả dụng' });
  await prisma.$transaction(async tx => {
    const moved = await tx.order.updateMany({ where: { id: order.id, status: order.status, remainingAmount: order.remainingAmount }, data: { remainingAmount: 0, settlementMethod: 'WALLET' } });
    if (!moved.count) throw Object.assign(new Error('Đơn vừa được thanh toán hoặc thay đổi'), { status: 409 });
    const escrow = await tx.escrow.updateMany({ where: { orderId: order.id, status: 'HELD' }, data: { amount: { increment: order.remainingAmount } } });
    if (!escrow.count) throw Object.assign(new Error('Khoản ký quỹ không còn khả dụng'), { status: 409 });
    await applyWallet(tx, order.buyerId, 'ORDER_PAYMENT', -order.remainingAmount, order.code, 'Thanh toán phần còn lại vào ký quỹ');
    await pushTimeline(tx, order.id, 'FULLY_PAID', 'Đã thanh toán đủ qua ví; toàn bộ tiền được giữ trong SafePay');
  });
  res.json({ message: 'Đã thanh toán phần còn lại, tiền được giữ trong SafePay' });
}));
module.exports = router;
