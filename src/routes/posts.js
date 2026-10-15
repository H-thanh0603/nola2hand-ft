// Posts: bài viết của người bán (review, kinh nghiệm chọn đồ 2hand)
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult } = require('../utils');

const router = express.Router();

const slugify = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
  '-' + Date.now().toString(36);

const postSchema = z.object({
  title: z.string().trim().min(10).max(200),
  excerpt: z.string().trim().max(300).optional(),
  coverUrl: z.string().url().optional(),
  content: z.string().trim().min(50),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).default('DRAFT'),
});

// GET /api/v1/posts — bài viết đã xuất bản
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { status: 'PUBLISHED' };
  if (req.query.q) where.title = { contains: req.query.q, mode: 'insensitive' };
  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.post.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

// GET /api/v1/posts/:slug
router.get('/:slug', asyncHandler(async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { slug: req.params.slug },
    include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
  });
  if (!post || post.status !== 'PUBLISHED')
    return res.status(404).json({ message: 'Không tìm thấy bài viết' });
  await prisma.post.update({ where: { id: post.id }, data: { views: { increment: 1 } } });
  res.json(post);
}));

// POST /api/v1/posts — người bán tạo bài
router.post('/', auth, requireRole('SELLER'), validate(postSchema), asyncHandler(async (req, res) => {
  const post = await prisma.post.create({
    data: { ...req.body, authorId: req.user.id, slug: slugify(req.body.title) },
  });
  res.status(201).json(post);
}));

// GET /api/v1/posts/me/all — bài viết của tôi
router.get('/me/all', auth, requireRole('SELLER'), asyncHandler(async (req, res) => {
  res.json(await prisma.post.findMany({
    where: { authorId: req.user.id }, orderBy: { updatedAt: 'desc' },
  }));
}));

// PATCH /api/v1/posts/:id
router.patch('/:id', auth, requireRole('SELLER'), validate(postSchema.partial()), asyncHandler(async (req, res) => {
  const post = await prisma.post.findFirst({ where: { id: +req.params.id, authorId: req.user.id } });
  if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
  res.json(await prisma.post.update({ where: { id: post.id }, data: req.body }));
}));

// DELETE /api/v1/posts/:id
router.delete('/:id', auth, requireRole('SELLER'), asyncHandler(async (req, res) => {
  const post = await prisma.post.findFirst({ where: { id: +req.params.id, authorId: req.user.id } });
  if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
  await prisma.post.delete({ where: { id: post.id } });
  res.json({ message: 'Đã xoá bài viết' });
}));

module.exports = router;
