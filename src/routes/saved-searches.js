const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { auth, asyncHandler, validate } = require('../middleware');
const { filterSchema, listingWhere } = require('../services/catalog');
const router = express.Router();
router.use(auth);
router.get('/', asyncHandler(async (req, res) => res.json(await prisma.savedSearch.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } }))));
router.post('/', validate(z.object({ name: z.string().trim().min(1).max(100), filters: filterSchema })), asyncHandler(async (req, res) => {
  const { page, limit, sort, ...filters } = req.body.filters;
  const search = await prisma.$transaction(async tx => {
    if (await tx.savedSearch.count({ where: { userId: req.user.id } }) >= 20) throw Object.assign(new Error('Tối đa 20 tìm kiếm theo dõi'), { status: 400 });
    const created = await tx.savedSearch.create({ data: { userId: req.user.id, name: req.body.name, filters } });
    const existing = await tx.listing.findMany({ where: listingWhere(filters), select: { id: true } });
    if (existing.length) await tx.savedSearchMatch.createMany({ data: existing.map(l => ({ searchId: created.id, listingId: l.id })), skipDuplicates: true });
    return created;
  });
  res.status(201).json(search);
}));
router.patch('/:id', validate(z.object({ enabled: z.boolean() })), asyncHandler(async (req, res) => {
  const updated = await prisma.savedSearch.updateMany({ where: { id: +req.params.id, userId: req.user.id }, data: req.body });
  if (!updated.count) return res.status(404).json({ message: 'Không tìm thấy tìm kiếm' });
  res.json({ message: 'Đã cập nhật theo dõi' });
}));
router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.savedSearch.deleteMany({ where: { id: +req.params.id, userId: req.user.id } });
  res.json({ message: 'Đã xóa theo dõi' });
}));
module.exports = router;
