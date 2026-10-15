// Shops: tìm kiếm gian hàng + trang shop công khai
const express = require('express');
const prisma = require('../prisma');
const { asyncHandler, auth } = require('../middleware');
const { paginate, pagedResult } = require('../utils');

const router = express.Router();

const shopSelect = {
  id: true,
  fullName: true,
  avatarUrl: true,
  createdAt: true,
  emailVerifiedAt: true,
  idVerified: true,
  sellerProfile: true,
};

// GET /api/v1/shops/search?q= — tìm kiếm gian hàng theo tên shop / tên người bán
router.get('/search', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const q = (req.query.q || '').trim();
  const where = {
    roles: { some: { role: { name: 'SELLER' } } },
    status: 'ACTIVE',
  };
  if (q) {
    where.OR = [
      { sellerProfile: { shopName: { contains: q, mode: 'insensitive' } } },
      { fullName: { contains: q, mode: 'insensitive' } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        ...shopSelect,
        _count: { select: { listings: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { sellerProfile: { rating: 'desc' } },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  const data = items.map((u) => ({
    id: u.id,
    shopName: u.sellerProfile?.shopName || u.fullName,
    fullName: u.fullName,
    avatarUrl: u.avatarUrl,
    rating: u.sellerProfile?.rating || 0,
    totalReviews: u.sellerProfile?.totalReviews || 0,
    totalOrders: u.sellerProfile?.totalOrders || 0,
    responseRate: null,
    emailVerified: Boolean(u.emailVerifiedAt),
    identityVerified: u.idVerified === true,
    productsCount: u._count.listings,
    joinedAt: u.createdAt,
  }));
  res.json(pagedResult(data, total, page, limit));
}));

// GET /api/v1/shops/:id — trang shop công khai (thông tin + tin đang bán)
router.get('/:id', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const user = await prisma.user.findFirst({
    where: { id: +req.params.id, status: 'ACTIVE', roles: { some: { role: { name: 'SELLER' } } } },
    select: shopSelect,
  });
  if (!user)
    return res.status(404).json({ message: 'Không tìm thấy gian hàng' });
  const profile = user.sellerProfile || {};
  const reputation = await require('../services/reputation').shopReputation(prisma,user);
  const where = { sellerId: user.id, status: 'ACTIVE' };
  const [listings, totalListings] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: { images: { take: 1 }, category: { select: { id: true, name: true } } },
      orderBy: [{ boostedUntil: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.listing.count({ where }),
  ]);
  // vài đánh giá mới nhất của shop
  const reviews = await prisma.review.findMany({
    where: { revieweeId: user.id },
    include: { reviewer: { select: { fullName: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  res.json({
    id: user.id,
    shopName: profile.shopName || user.fullName,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    rating: reputation.rating,
    totalReviews: reputation.totalReviews,
    totalOrders: reputation.completedOrders,
    responseRate: reputation.responseRate,
    reputation,
    joinedAt: user.createdAt,
    listings: pagedResult(listings, totalListings, page, limit),
    recentReviews: reviews,
  });
}));

module.exports = router;
