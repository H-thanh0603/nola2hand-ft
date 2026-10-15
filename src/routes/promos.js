// Promos: khuyến mãi — public xem, admin nội dung quản lý
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult } = require('../utils');

const router = express.Router();

// GET /api/v1/promos — khuyến mãi đang chạy (public)
router.get('/', asyncHandler(async (req, res) => {
  const now = new Date();
  res.json(await prisma.promo.findMany({
    where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { endsAt: 'asc' },
  }));
}));

// POST /api/v1/promos/validate — kiểm tra mã trước khi đặt hàng
router.post('/validate', auth, validate(z.object({
  code: z.string(), orderAmount: z.number().int().min(0),
})), asyncHandler(async (req, res) => {
  const promo = await prisma.promo.findUnique({ where: { code: req.body.code } });
  const now = new Date();
  if (!promo || promo.status !== 'ACTIVE' || promo.startsAt > now || promo.endsAt < now)
    return res.status(400).json({ valid: false, message: 'Mã không hợp lệ hoặc đã hết hạn' });
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit)
    return res.status(400).json({ valid: false, message: 'Mã đã hết lượt sử dụng' });
  if (req.body.orderAmount < promo.minOrder)
    return res.status(400).json({ valid: false, message: `Đơn tối thiểu ${promo.minOrder.toLocaleString('vi-VN')}đ` });
  const discount = promo.discountType === 'PERCENT'
    ? Math.min(Math.round((req.body.orderAmount * promo.discountValue) / 100), promo.maxDiscount || Infinity)
    : promo.discountValue;
  res.json({ valid: true, promo: { name: promo.name, code: promo.code }, discount });
}));

const promoSchema = z.object({
  name: z.string().trim().min(1).max(150),
  type: z.enum(['PLATFORM_FEE_DISCOUNT', 'FREESHIP', 'VOUCHER', 'BOOST']),
  code: z.string().trim().max(30).optional(),
  discountType: z.enum(['PERCENT', 'AMOUNT']).default('PERCENT'),
  discountValue: z.number().int().min(0),
  maxDiscount: z.number().int().optional(),
  minOrder: z.number().int().default(0),
  usageLimit: z.number().int().optional(),
  startsAt: z.string(), endsAt: z.string(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED']).default('DRAFT'),
});

// GET /api/v1/admin/promos — tất cả (admin nội dung)
router.get('/admin/all', auth, requireRole('ADMIN_CONTENT'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.type) where.type = req.query.type;
  const [items, total] = await Promise.all([
    prisma.promo.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.promo.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

router.post('/admin', auth, requireRole('ADMIN_CONTENT'), validate(promoSchema), asyncHandler(async (req, res) => {
  const data = { ...req.body, startsAt: new Date(req.body.startsAt), endsAt: new Date(req.body.endsAt) };
  res.status(201).json(await prisma.promo.create({ data }));
}));

router.patch('/admin/:id', auth, requireRole('ADMIN_CONTENT'), validate(promoSchema.partial()), asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (data.startsAt) data.startsAt = new Date(data.startsAt);
  if (data.endsAt) data.endsAt = new Date(data.endsAt);
  res.json(await prisma.promo.update({ where: { id: +req.params.id }, data }));
}));

router.delete('/admin/:id', auth, requireRole('ADMIN_CONTENT'), asyncHandler(async (req, res) => {
  await prisma.promo.delete({ where: { id: +req.params.id } });
  res.json({ message: 'Đã xoá khuyến mãi' });
}));

module.exports = router;
