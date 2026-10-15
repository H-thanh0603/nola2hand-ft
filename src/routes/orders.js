// Orders: đơn hàng — tạo từ offer đã duyệt / mua ngay, chuyển trạng thái
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult, genOrderCode, calcPlatformFee, pushTimeline, notify } = require('../utils');
const { lockUser } = require('../services/locks');
const { accountLimit, verifiedAccount } = require('../services/guards');
const { phoneVN } = require('../validators');

const router = express.Router();

const orderInclude = {
  returnRequest: true,
  listing: { include: { images: { take: 1 } } },
  buyer: { select: { id: true, fullName: true, avatarUrl: true, phone: true } },
  seller: { select: { id: true, fullName: true, avatarUrl: true, phone: true } },
  escrow: true,
  timeline: { orderBy: { createdAt: 'asc' } },
};

const createOrderSchema = z.object({
  listingId: z.number().int(),
  offerId: z.number().int().optional(), // nếu mua theo giá đã thương lượng
  shipName: z.string().trim().min(1, 'Tên người nhận không được bỏ trống').max(100),
  shipPhone: phoneVN.max(20),
  shipAddress: z.string().trim().min(1, 'Địa chỉ nhận hàng không được bỏ trống').max(500),
  note: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(['MOMO_QR', 'SAFEPAY_WALLET', 'BANK_TRANSFER', 'NAPAS', 'COD']).default('MOMO_QR'),
  promoCode: z.string().optional(),
  settlementMethod: z.enum(['COD', 'WALLET']).default('COD'),
});

// Tạo 1 đơn hàng — dùng chung cho "Mua ngay" (POST /) và "Checkout giỏ hàng"
async function createSingleOrder({ buyerId, listingId, offerId, promoCode, ship }) {
  await require('../services/reservations').expireReservations();
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { category: true },
  });
  const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
  if (!listing || listing.status !== 'ACTIVE') fail(404, 'Sản phẩm không khả dụng');
  if (listing.sellerId === buyerId) fail(400, 'Không thể mua tin của chính mình');

  let priceAgreed = listing.price;
  if (offerId) {
    const offer = await prisma.priceOffer.findUnique({ where: { id: offerId } });
    if (!offer || offer.buyerId !== buyerId || offer.listingId !== listing.id || offer.status !== 'ACCEPTED'
      || offer.expiresAt <= new Date())
      fail(400, 'Yêu cầu trả giá không hợp lệ');
    priceAgreed = offer.offeredPrice;
  }

  let discountAmount = 0;
  let promo;
  if (promoCode) {
    promo = await prisma.promo.findUnique({ where: { code: promoCode } });
    const now = new Date();
    if (!promo || promo.status !== 'ACTIVE' || promo.startsAt > now || promo.endsAt < now)
      fail(400, 'Mã khuyến mãi không hợp lệ');
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit)
      fail(400, 'Mã đã hết lượt sử dụng');
    if (priceAgreed < promo.minOrder)
      fail(400, `Đơn tối thiểu ${promo.minOrder.toLocaleString('vi-VN')}đ`);
    discountAmount = promo.discountType === 'PERCENT'
      ? Math.min(Math.round((priceAgreed * promo.discountValue) / 100), promo.maxDiscount || Infinity)
      : promo.discountValue;
    discountAmount = Math.min(discountAmount, priceAgreed);
  }

  const { fee: platformFee } = await calcPlatformFee(listing.categoryId, priceAgreed);
  const shippingFee = 15000;
  const totalAmount = priceAgreed - discountAmount + shippingFee;

  const order = await prisma.$transaction(async (tx) => {
    await lockUser(tx, buyerId);
    if (await tx.order.count({ where: { buyerId, status: 'PENDING_DEPOSIT' } }) >= 3) fail(429, 'Tối đa 3 đơn đang chờ đặt cọc. Hãy thanh toán hoặc hủy đơn cũ.');
    const reserved = await tx.listing.updateMany({
      where: { id: listing.id, status: 'ACTIVE' },
      data: { status: 'RESERVED' },
    });
    if (!reserved.count) fail(409, 'Sản phẩm vừa được người khác đặt, vui lòng chọn tin khác');

    const o = await tx.order.create({
      data: {
        code: genOrderCode(),
        buyerId,
        sellerId: listing.sellerId,
        listingId: listing.id,
        priceAgreed,
        remainingAmount: totalAmount,
        reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        shippingFee,
        discountAmount,
        totalAmount,
        platformFee,
        ...ship,
      },
    });
    await pushTimeline(tx, o.id, 'PENDING_DEPOSIT', 'Đơn hàng được tạo, chờ đặt cọc');
    if (promoCode) {
      const promoWhere = {
        id: promo.id,
        status: 'ACTIVE',
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
        ...(promo.usageLimit ? { usedCount: { lt: promo.usageLimit } } : {}),
      };
      const claimed = await tx.promo.updateMany({
        where: promoWhere,
        data: { usedCount: { increment: 1 } },
      });
      if (!claimed.count) fail(400, 'Mã đã hết lượt sử dụng');
      await tx.promoUsage.create({ data: { promoId: promo.id, userId: buyerId, orderId: o.id } });
    }
    return o;
  });

  await notify(null, listing.sellerId, 'ORDER', 'Có đơn hàng mới',
    `Đơn ${order.code}: "${listing.title}" — ${priceAgreed.toLocaleString('vi-VN')}đ`, { orderId: order.id });
  return order;
}

// POST /api/v1/orders — tạo đơn (người mua)
router.post(
  '/',
  auth,
  verifiedAccount,
  accountLimit('CREATE_ORDER', 20, 86400000),
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const { listingId, offerId, promoCode, ...ship } = req.body;
    const order = await createSingleOrder({ buyerId: req.user.id, listingId, offerId, promoCode, ship });
    res.status(201).json(order);
  })
);


// GET /api/v1/orders/mine — đơn tôi mua
router.get('/mine', auth, asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { buyerId: req.user.id };
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.order.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

// GET /api/v1/orders/sales — đơn tôi bán (người bán)
router.get('/sales', auth, requireRole('SELLER'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { sellerId: req.user.id };
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.order.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

// GET /api/v1/orders/admin/all — admin quản lý tất cả đơn hàng
router.get(
  '/admin/all',
  auth,
  requireRole('ADMIN_FINANCE', 'ADMIN_CONTENT'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.q) where.code = { contains: req.query.q, mode: 'insensitive' };
    const [items, total] = await Promise.all([
      prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.order.count({ where }),
    ]);
    res.json(pagedResult(items, total, page, limit));
  })
);

// GET /api/v1/orders/:id — chi tiết (buyer hoặc seller của đơn)
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: +req.params.id },
    include: { ...orderInclude, review: true, returnRequest: true },
  });
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
  if (order.buyerId !== req.user.id && order.sellerId !== req.user.id
    && !req.user.roles.some((r) => r.startsWith('ADMIN')))
    return res.status(403).json({ message: 'Không có quyền xem đơn này' });
  res.json(order);
}));

// Luồng trạng thái hợp lệ
const TRANSITIONS = {
  PENDING_DEPOSIT: ['CANCELLED'],
  DEPOSITED: ['CONFIRMED', 'CANCELLED'],       // seller xác nhận / huỷ
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],                    // buyer xác nhận đã nhận
};

// PATCH /api/v1/orders/:id/status — chuyển trạng thái đơn
router.patch(
  '/:id/status',
  auth,
  validate(z.object({
    to: z.enum(['CONFIRMED', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED']),
    note: z.string().trim().max(500).optional(),
    trackingCode: z.string().trim().optional(),
  })),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: +req.params.id } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    const { to, note, trackingCode } = req.body;

    const allowed = TRANSITIONS[order.status] || [];
    if (!allowed.includes(to))
      return res.status(400).json({ message: `Không thể chuyển từ ${order.status} sang ${to}` });

    // Phân quyền theo bước
    const isBuyer = order.buyerId === req.user.id;
    const isSeller = order.sellerId === req.user.id;
    if (['CONFIRMED', 'SHIPPING', 'DELIVERED'].includes(to) && !isSeller)
      return res.status(403).json({ message: 'Chỉ người bán thực hiện bước này' });
    if (to === 'COMPLETED' && !isBuyer)
      return res.status(403).json({ message: 'Chỉ người mua xác nhận đã nhận hàng' });
    if (to === 'COMPLETED' && order.remainingAmount > 0)
      return res.status(400).json({ message: 'Cần thanh toán phần còn lại hoặc người bán xác nhận đã thu COD trước khi hoàn tất' });
    if (to === 'CANCELLED' && !isBuyer && !isSeller)
      return res.status(403).json({ message: 'Không có quyền huỷ đơn' });

    const updated = await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: to, trackingCode: trackingCode || order.trackingCode, cancelReason: to === 'CANCELLED' ? note : order.cancelReason },
      });
      if (!moved.count) {
        const e = new Error('Trạng thái đơn vừa thay đổi, vui lòng tải lại');
        e.status = 409;
        throw e;
      }
      const o = await tx.order.findUnique({ where: { id: order.id } });
      await pushTimeline(tx, o.id, to, note);

      if (to === 'CANCELLED') {
        const escrow = await tx.escrow.findUnique({ where: { orderId: o.id } });
        if (escrow?.status === 'HELD') {
          const refunded = await tx.escrow.updateMany({
            where: { id: escrow.id, status: 'HELD' },
            data: { status: 'REFUNDED', releasedAt: new Date() },
          });
          if (refunded.count) {
            const { applyWallet } = require('../utils');
            await applyWallet(tx, o.buyerId, 'REFUND', escrow.amount, o.code, `Hoàn cọc đơn đã huỷ ${o.code}`);
          }
        }
        await tx.listing.updateMany({
          where: { id: o.listingId, status: 'RESERVED' },
          data: { status: 'ACTIVE' },
        });
      }

      // Buyer xác nhận đã nhận → giải ngân escrow cho seller
      if (to === 'COMPLETED') {
        const escrow = await tx.escrow.findUnique({ where: { orderId: o.id } });
        if (escrow && escrow.status === 'HELD') {
          const { applyWallet } = require('../utils');
          const released = await tx.escrow.updateMany({
            where: { id: escrow.id, status: 'HELD' },
            data: { status: 'RELEASED', releasedAt: new Date() },
          });
          if (released.count) {
            const platformFee = Math.min(o.platformFee, escrow.amount);
            const sellerIncome = escrow.amount;
            if (sellerIncome) await applyWallet(tx, o.sellerId, 'ORDER_INCOME', sellerIncome, o.code, `Tiền cọc đơn ${o.code}`);
            if (platformFee) await applyWallet(tx, o.sellerId, 'PLATFORM_FEE', -platformFee, o.code, `Phí sàn đơn ${o.code}`);
            await tx.listing.update({ where: { id: o.listingId }, data: { status: 'SOLD_OUT' } });
          }
        }
      }
      return o;
    });

    const otherId = isBuyer ? order.sellerId : order.buyerId;
    await notify(null, otherId, 'ORDER', `Đơn ${order.code}: ${to}`,
      note || `Trạng thái đơn hàng chuyển sang ${to}`, { orderId: order.id });
    res.json(updated);
  })
);

router.post('/:id/confirm-cod', auth, asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: +req.params.id } });
  if (!order || order.sellerId !== req.user.id) return res.status(404).json({ message: 'Không tìm thấy đơn bán' });
  if (order.settlementMethod !== 'COD' || order.status !== 'DELIVERED' || order.remainingAmount <= 0)
    return res.status(400).json({ message: 'Chỉ xác nhận COD sau khi giao hàng và còn tiền cần thu' });
  await prisma.$transaction(async tx => {
    const moved = await tx.order.updateMany({ where: { id: order.id, status: 'DELIVERED', remainingAmount: order.remainingAmount, codCollectedAt: null }, data: { remainingAmount: 0, codCollectedAt: new Date() } });
    if (!moved.count) throw Object.assign(new Error('Đơn vừa thay đổi'), { status: 409 });
    await pushTimeline(tx, order.id, 'COD_COLLECTED', `Người bán khai báo đã thu ${order.remainingAmount.toLocaleString('vi-VN')}đ COD; chờ người mua xác nhận hoàn tất`);
  });
  await notify(null, order.buyerId, 'ORDER', 'Người bán đã xác nhận thu COD', order.code, { orderId: order.id });
  res.json({ message: 'Đã ghi nhận thu COD; tiền này không được cộng lần nữa vào ví' });
}));

module.exports = router;
module.exports.createSingleOrder = createSingleOrder;
