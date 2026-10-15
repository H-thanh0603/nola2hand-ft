// Seller: dashboard tổng quan kênh người bán
const express = require('express');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole } = require('../middleware');

const router = express.Router();
router.use(auth, requireRole('SELLER'));
router.get('/listings/:id', asyncHandler(async (req, res) => {
  const listing = await prisma.listing.findFirst({ where: { id: +req.params.id, sellerId: req.user.id }, include: { images: { orderBy: { sortOrder: 'asc' } }, category: true } });
  if (!listing) return res.status(404).json({ message: 'Không tìm thấy tin đăng của bạn' });
  res.json(listing);
}));

// GET /api/v1/seller/dashboard
router.get('/dashboard', asyncHandler(async (req, res) => {
  const sellerId = req.user.id;
  const weekAgo = new Date(Date.now() - 7 * 86400 * 1000);

  const [
    activeListings, pendingOrders, viewsAgg,
    listingStatus, recentOrders, recentActivities,
  ] = await Promise.all([
    prisma.listing.count({ where: { sellerId, status: 'ACTIVE' } }),
    prisma.order.count({ where: { sellerId, status: { in: ['DEPOSITED', 'CONFIRMED'] } } }),
    prisma.listing.aggregate({ where: { sellerId }, _sum: { views: true } }),
    prisma.listing.groupBy({ by: ['status'], where: { sellerId }, _count: true }),
    prisma.order.findMany({
      where: { sellerId },
      include: { buyer: { select: { fullName: true } }, listing: { select: { title: true } } },
      orderBy: { createdAt: 'desc' }, take: 5,
    }),
    prisma.orderTimeline.findMany({
      where: { order: { sellerId } },
      include: { order: { select: { code: true } } },
      orderBy: { createdAt: 'desc' }, take: 8,
    }),
  ]);
  const [income, held, orderValue] = await Promise.all([
    prisma.walletTransaction.aggregate({ where: { wallet: { userId: sellerId }, type: { in: ['ORDER_INCOME', 'PLATFORM_FEE'] }, status: 'SUCCESS', createdAt: { gte: weekAgo } }, _sum: { amount: true } }),
    prisma.escrow.aggregate({ where: { order: { sellerId }, status: 'HELD' }, _sum: { amount: true } }),
    prisma.order.aggregate({ where: { sellerId, status: { notIn: ['CANCELLED', 'REFUNDED'] } }, _sum: { totalAmount: true } }),
  ]);

  const topProducts = await prisma.listing.findMany({
    where: { sellerId, status: { in: ['ACTIVE', 'SOLD_OUT'] } },
    include: {
      images: { take: 1 },
      _count: { select: { orders: true } },
    },
    orderBy: { views: 'desc' }, take: 5,
  });

  res.json({
    kpis: {
      activeListings,
      pendingOrders,
      totalViews: viewsAgg._sum.views || 0,
      weeklyRevenue: income._sum.amount || 0,
      escrowHeld: held._sum.amount || 0,
      orderValue: orderValue._sum.totalAmount || 0,
    },
    listingStatus,
    recentOrders,
    recentActivities,
    topProducts: topProducts.map((p) => ({
      id: p.id, title: p.title, price: p.price, views: p.views,
      orders: p._count.orders, image: p.images[0]?.url,
    })),
  });
}));

// GET /api/v1/seller/listings — tin đăng của tôi (kèm bộ lọc trạng thái)
router.get('/listings', asyncHandler(async (req, res) => {
  const { paginate, pagedResult } = require('../utils');
  const { page, limit, skip } = paginate(req.query);
  const where = { sellerId: req.user.id };
  if (req.query.status) where.status = req.query.status;
  if (req.query.q) where.title = { contains: req.query.q, mode: 'insensitive' };
  const listings = await prisma.listing.findMany({
    where,
    include: { images: { take: 1 }, category: { select: { name: true } }, _count: { select: { orders: true } } },
    orderBy: { updatedAt: 'desc' },
    take: limit, skip,
  });
  res.json(pagedResult(listings, await prisma.listing.count({ where }), page, limit));
}));


// GET /api/v1/seller/charts/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD — biểu đồ cột doanh thu shop theo ngày
router.get('/charts/revenue', asyncHandler(async (req, res) => {
  res.json(await require('../services/revenue').dailyRevenue(prisma, req.query, req.user.id));
}));

module.exports = router;
