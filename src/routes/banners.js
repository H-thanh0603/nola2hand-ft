// Banners: banner quảng cáo — public xem theo vị trí, admin nội dung quản lý
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult } = require('../utils');
const { httpUrl } = require('../validators');

const router = express.Router();

// GET /api/v1/banners?position=HOME_HERO — banner đang chạy (public)
router.get('/', asyncHandler(async (req, res) => {
  const now = new Date();
  const where = { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } };
  if (req.query.position) where.position = req.query.position;
  res.json(await prisma.banner.findMany({ where, orderBy: { createdAt: 'desc' } }));
}));

const bannerSchema = z.object({
  title: z.string().trim().min(1).max(150),
  imageUrl: httpUrl('Ảnh banner'),
  linkUrl: httpUrl('Link').optional().or(z.literal('')),
  position: z.enum(['HOME_HERO', 'HOME_SECONDARY', 'CATEGORY']),
  startsAt: z.string(), endsAt: z.string(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED']).default('DRAFT'),
});

router.get('/admin/all', auth, requireRole('ADMIN_CONTENT'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.banner.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.banner.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

router.post('/admin', auth, requireRole('ADMIN_CONTENT'), validate(bannerSchema), asyncHandler(async (req, res) => {
  const data = { ...req.body, startsAt: new Date(req.body.startsAt), endsAt: new Date(req.body.endsAt) };
  res.status(201).json(await prisma.banner.create({ data }));
}));

router.patch('/admin/:id', auth, requireRole('ADMIN_CONTENT'), validate(bannerSchema.partial()), asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (data.startsAt) data.startsAt = new Date(data.startsAt);
  if (data.endsAt) data.endsAt = new Date(data.endsAt);
  res.json(await prisma.banner.update({ where: { id: +req.params.id }, data }));
}));

router.delete('/admin/:id', auth, requireRole('ADMIN_CONTENT'), asyncHandler(async (req, res) => {
  await prisma.banner.delete({ where: { id: +req.params.id } });
  res.json({ message: 'Đã xoá banner' });
}));

module.exports = router;
