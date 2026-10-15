// Cart: giỏ hàng (mỗi tin đồ cũ là duy nhất nên không có số lượng)
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, validate } = require('../middleware');
const { createSingleOrder } = require('./orders');
const { accountLimit, verifiedAccount } = require('../services/guards');
const { phoneVN } = require('../validators');

const router = express.Router();

const cartInclude = {
  listing: {
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true } },
      seller: { select: { id: true, fullName: true } },
    },
  },
};

// GET /api/v1/cart — giỏ hàng của tôi
router.get('/', auth, asyncHandler(async (req, res) => {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: cartInclude,
    orderBy: { createdAt: 'desc' },
  });
  const total = items.reduce((s, it) => s + (it.listing.isFree ? 0 : it.listing.price), 0);
  res.json({ items, total, count: items.length });
}));

// POST /api/v1/cart — thêm vào giỏ
router.post(
  '/',
  auth,
  validate(z.object({ listingId: z.number().int() })),
  asyncHandler(async (req, res) => {
    const { listingId } = req.body;
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== 'ACTIVE')
      return res.status(404).json({ message: 'Sản phẩm không khả dụng' });
    if (listing.sellerId === req.user.id)
      return res.status(400).json({ message: 'Không thể thêm tin của chính mình vào giỏ' });
    const item = await prisma.cartItem.upsert({
      where: { userId_listingId: { userId: req.user.id, listingId } },
      update: {},
      create: { userId: req.user.id, listingId },
      include: cartInclude,
    });
    const count = await prisma.cartItem.count({ where: { userId: req.user.id } });
    res.status(201).json({ item, count, message: 'Đã thêm vào giỏ hàng' });
  })
);

// DELETE /api/v1/cart/:listingId — xoá 1 món
router.delete('/:listingId', auth, asyncHandler(async (req, res) => {
  await prisma.cartItem.deleteMany({
    where: { userId: req.user.id, listingId: +req.params.listingId },
  });
  const count = await prisma.cartItem.count({ where: { userId: req.user.id } });
  res.json({ count, message: 'Đã xoá khỏi giỏ hàng' });
}));

// DELETE /api/v1/cart — xoá toàn bộ giỏ
router.delete('/', auth, asyncHandler(async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
  res.json({ count: 0, message: 'Đã xoá toàn bộ giỏ hàng' });
}));

const checkoutSchema = z.object({
  listingIds: z.array(z.number().int()).min(1).max(20),
  shipName: z.string().trim().min(1, 'Tên người nhận không được bỏ trống').max(100),
  shipPhone: phoneVN.max(20),
  shipAddress: z.string().trim().min(1, 'Địa chỉ nhận hàng không được bỏ trống').max(500),
  note: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(['MOMO_QR', 'SAFEPAY_WALLET', 'BANK_TRANSFER', 'NAPAS', 'COD']).default('MOMO_QR'),
});

// POST /api/v1/cart/checkout — đặt hàng từ giỏ (mỗi tin 1 đơn vì khác người bán)
router.post(
  '/checkout',
  auth,
  verifiedAccount,
  accountLimit('CHECKOUT', 10, 86400000),
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const { listingIds, ...ship } = req.body;
    const orders = [];
    const errors = [];
    for (const listingId of listingIds) {
      try {
        const order = await createSingleOrder({ buyerId: req.user.id, listingId, ship });
        orders.push(order);
        await prisma.cartItem.deleteMany({ where: { userId: req.user.id, listingId } });
      } catch (e) {
        errors.push({ listingId, message: e.message });
      }
    }
    if (!orders.length)
      return res.status(400).json({ message: 'Không tạo được đơn nào', errors });
    res.status(201).json({ orders, errors, message: `Đã tạo ${orders.length} đơn hàng` });
  })
);

module.exports = router;
