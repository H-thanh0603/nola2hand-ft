// Reviews: đánh giá sau mua — người mua đánh giá người bán / sản phẩm
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult, notify } = require('../utils');

const router = express.Router();

// POST /api/v1/orders/:id/reviews — đánh giá sau khi đơn COMPLETED
router.post(
  '/orders/:id/reviews',
  auth,
  validate(z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional(),
    type: z.enum(['SELLER', 'PRODUCT']).default('SELLER'),
    listingId: z.number().int().optional(),
  })),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: +req.params.id } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    if (order.buyerId !== req.user.id)
      return res.status(403).json({ message: 'Chỉ người mua mới đánh giá được' });
    if (order.status !== 'COMPLETED')
      return res.status(400).json({ message: 'Chỉ đánh giá khi đơn đã hoàn tất' });
    const exists = await prisma.review.findUnique({ where: { orderId: order.id } });
    if (exists) return res.status(400).json({ message: 'Đơn này đã được đánh giá' });
    if (req.body.listingId !== undefined && req.body.listingId !== order.listingId) return res.status(400).json({ message: 'Sản phẩm đánh giá phải thuộc đơn đã mua' });
    const sentiment = await require('../services/ai').analyzeSentiment(req.body.comment, req.body.rating);

    const review = await prisma.$transaction(async (tx) => {
      const r = await tx.review.create({
        data: {
          orderId: order.id,
          reviewerId: req.user.id,
          revieweeId: order.sellerId,
          listingId: req.body.type === 'PRODUCT' ? order.listingId : null,
          ...sentiment,
          rating: req.body.rating,
          comment: req.body.comment,
          type: req.body.type,
        },
      });
      // Cập nhật rating trung bình của shop
      const agg = await tx.review.aggregate({
        where: { revieweeId: order.sellerId },
        _avg: { rating: true }, _count: true,
      });
      await tx.sellerProfile.update({
        where: { userId: order.sellerId },
        data: { rating: agg._avg.rating || 0, totalReviews: agg._count },
      });
      return r;
    });

    await notify(null, order.sellerId, 'SYSTEM', 'Bạn có đánh giá mới',
      `Đơn ${order.code} được đánh giá ${req.body.rating}★`, { orderId: order.id });
    res.status(201).json({ message: 'Cảm ơn bạn đã đánh giá', review });
  })
);

// POST /api/v1/reviews/:id/reply — người bán phản hồi đánh giá
router.post(
  '/:id/reply',
  auth,
  requireRole('SELLER'),
  validate(z.object({ reply: z.string().trim().min(1).max(1000) })),
  asyncHandler(async (req, res) => {
    const review = await prisma.review.findUnique({ where: { id: +req.params.id } });
    if (!review || review.revieweeId !== req.user.id)
      return res.status(404).json({ message: 'Không tìm thấy đánh giá' });
    res.json(await prisma.review.update({
      where: { id: review.id }, data: { sellerReply: req.body.reply },
    }));
  })
);

// GET /api/v1/reviews/users/:userId — đánh giá về 1 người
router.get('/users/:userId', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { revieweeId: +req.params.userId };
  if (req.query.type) where.type = req.query.type;
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
        listing: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.review.count({ where }),
  ]);
  const stats = await prisma.review.groupBy({
    by: ['rating'], where: { revieweeId: +req.params.userId }, _count: true,
  });
  res.json({ ...pagedResult(items, total, page, limit), ratingStats: stats });
}));

// GET /api/v1/reviews/mine/pending — đơn chờ tôi đánh giá
router.get('/mine/pending', auth, asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { buyerId: req.user.id, status: 'COMPLETED', review: null },
    include: { listing: { include: { images: { take: 1 } } }, seller: { select: { fullName: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(orders);
}));

router.get('/insights', auth, requireRole('SELLER', 'ADMIN_CONTENT', 'ADMIN_FINANCE'), asyncHandler(async (req, res) => {
  const admin = req.user.roles.some(r => r.startsWith('ADMIN'));
  if (req.query.userId && (!Number.isSafeInteger(+req.query.userId) || +req.query.userId <= 0)) return res.status(400).json({ message: 'Người bán không hợp lệ' });
  const where = admin && !req.query.userId ? {} : { revieweeId: admin ? +req.query.userId : req.user.id };
  const rows = await prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500, select: { comment: true, rating: true, sentiment: true, sentimentSource: true } });
  const reviews = rows.map(r => r.sentimentSource === 'AI' ? r : { ...r, ...require('../services/ai').localSentiment(r.comment, r.rating) });
  const topics = [{ name: 'Giao hàng chậm', pattern: /giao.*chậm|chậm.*giao/i }, { name: 'Không đúng mô tả', pattern: /không đúng|sai mô tả/i }, { name: 'Lỗi / hỏng', pattern: /hỏng|bị lỗi|không hoạt động/i }, { name: 'Thái độ / phản hồi', pattern: /thái độ|không phản hồi|không trả lời/i }];
  res.json({ sampleSize: reviews.length, averageRating: reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0, sentiments: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'].map(sentiment => ({ sentiment, count: reviews.filter(r => r.sentiment === sentiment).length })), sources: { ai: reviews.filter(r => r.sentimentSource === 'AI').length, local: reviews.filter(r => r.sentimentSource !== 'AI').length }, issues: topics.map(t => ({ name: t.name, count: reviews.filter(r => t.pattern.test(r.comment || '')).length })) });
}));
module.exports = router;
