// Categories: danh mục sản phẩm
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');

const router = express.Router();
router.get('/specifications', (req, res) => res.json(require('../services/catalog').specificationFields));

// GET /api/v1/categories — cây danh mục
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cats = await prisma.category.findMany({
      where: { parentId: null },
      include: { children: true, _count: { select: { listings: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(cats);
  })
);

const catSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().toLowerCase().min(1).max(100),
  icon: z.string().optional(),
  parentId: z.number().int().optional(),
  feePct: z.number().min(0).max(100).optional(),
});

// POST /api/v1/categories (admin nội dung)
router.post(
  '/',
  auth,
  requireRole('ADMIN_CONTENT'),
  validate(catSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await prisma.category.create({ data: req.body }));
  })
);

// PATCH /api/v1/categories/:id
router.patch(
  '/:id',
  auth,
  requireRole('ADMIN_CONTENT'),
  validate(catSchema.partial()),
  asyncHandler(async (req, res) => {
    res.json(await prisma.category.update({ where: { id: +req.params.id }, data: req.body }));
  })
);

// DELETE /api/v1/categories/:id
router.delete(
  '/:id',
  auth,
  requireRole('ADMIN_CONTENT'),
  asyncHandler(async (req, res) => {
    const count = await prisma.listing.count({ where: { categoryId: +req.params.id } });
    if (count > 0)
      return res.status(400).json({ message: `Danh mục còn ${count} tin đăng, không thể xoá` });
    await prisma.category.delete({ where: { id: +req.params.id } });
    res.json({ message: 'Đã xoá danh mục' });
  })
);

module.exports = router;
