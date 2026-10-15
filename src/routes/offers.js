// PriceOffer: trả giá — người mua gửi đề xuất, người bán duyệt/từ chối
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult, notify } = require('../utils');

const router = express.Router();
const OFFER_TTL_HOURS = 24;

const offerSchema = z.object({
  offeredPrice: z.number().int().min(1000, 'Giá đề xuất tối thiểu 1.000đ').max(10_000_000_000),
  message: z.string().trim().max(500).optional(),
  shipMethod: z.enum(['NOLA_SHIP', 'MEETUP']).default('NOLA_SHIP'),
});

// GET /api/v1/offers/mine — yêu cầu tôi đã gửi (người mua)
router.get('/mine', auth, asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { buyerId: req.user.id };
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.priceOffer.findMany({
      where,
      include: { listing: { include: { images: { take: 1 }, seller: { select: { fullName: true } } } } },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.priceOffer.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

// GET /api/v1/offers/inbox — yêu cầu gửi tới tôi (người bán)
router.get('/inbox', auth, requireRole('SELLER'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { listing: { sellerId: req.user.id } };
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.priceOffer.findMany({
      where,
      include: { listing: { select: { title: true, price: true } }, buyer: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.priceOffer.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

// PATCH /api/v1/offers/:id — người bán đồng ý / từ chối; người mua huỷ
router.patch(
  '/:id',
  auth,
  validate(z.object({ action: z.enum(['ACCEPT', 'REJECT', 'CANCEL']) })),
  asyncHandler(async (req, res) => {
    const offer = await prisma.priceOffer.findUnique({
      where: { id: +req.params.id },
      include: { listing: true },
    });
    if (!offer) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' });
    if (offer.status !== 'PENDING')
      return res.status(400).json({ message: `Yêu cầu đã ở trạng thái ${offer.status}` });

    const { action } = req.body;
    const isSeller = offer.listing.sellerId === req.user.id;
    const isBuyer = offer.buyerId === req.user.id;

    if (action === 'ACCEPT' || action === 'REJECT') {
      if (!isSeller) return res.status(403).json({ message: 'Chỉ người bán mới duyệt được' });
    } else if (!isBuyer) {
      return res.status(403).json({ message: 'Chỉ người mua mới huỷ được' });
    }

    const status = action === 'ACCEPT' ? 'ACCEPTED' : action === 'REJECT' ? 'REJECTED' : 'CANCELLED';
    if (offer.expiresAt <= new Date()) return res.status(400).json({ message: 'Yêu cầu trả giá đã hết hạn' });
    if (action === 'ACCEPT' && offer.listing.status !== 'ACTIVE') return res.status(409).json({ message: 'Tin không còn khả dụng' });
    const moved = await prisma.priceOffer.updateMany({ where: { id: offer.id, status: 'PENDING', expiresAt: { gt: new Date() } }, data: { status } });
    if (!moved.count) return res.status(409).json({ message: 'Yêu cầu đã thay đổi hoặc hết hạn' });
    const updated = await prisma.priceOffer.findUnique({ where: { id: offer.id } });

    const targetId = isSeller ? offer.buyerId : offer.listing.sellerId;
    const titles = { ACCEPT: 'Người bán đã đồng ý mức giá', REJECT: 'Người bán đã từ chối', CANCEL: 'Người mua đã huỷ yêu cầu' };
    await notify(null, targetId, 'OFFER', titles[action],
      `Yêu cầu trả giá ${offer.offeredPrice.toLocaleString('vi-VN')}đ cho "${offer.listing.title}": ${status}`,
      { offerId: offer.id });

    res.json({ message: titles[action], offer: updated });
  })
);

module.exports = router;
