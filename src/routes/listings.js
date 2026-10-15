// Listings: tin đăng — tìm kiếm, chi tiết, đăng/sửa/xoá, yêu thích, kiểm duyệt
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult, notify } = require('../utils');
const { filterSchema, listingWhere, validateSpecifications } = require('../services/catalog');
const { accountLimit, verifiedAccount } = require('../services/guards');
const { httpUrl } = require('../validators');

const router = express.Router();

const listingInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
  category: true,
  seller: {
    select: {
      id: true, fullName: true, avatarUrl: true, isVerified: true,
      emailVerifiedAt: true, idVerified: true,
      sellerProfile: true,
    },
  },
  _count: { select: { favorites: true } },
};

// GET /api/v1/listings?q=&categoryId=&condition=&minPrice=&maxPrice=&isFree=&sort=
router.get('/compare',asyncHandler(async(req,res)=>{
  const ids=z.array(z.coerce.number().int().positive()).min(1).max(3).parse(String(req.query.ids || '').split(','));
  if(new Set(ids).size!==ids.length)return res.status(400).json({message:'Không chọn trùng sản phẩm'});
  const items=await prisma.listing.findMany({where:{id:{in:ids},status:'ACTIVE',seller:{status:'ACTIVE'}},include:{...listingInclude,priceHistory:{orderBy:[{createdAt:'desc'},{id:'desc'}],take:300}}});
  res.json({items:ids.map(id=>items.find(i=>i.id===id)).filter(Boolean).map(i=>({...i,priceHistory:i.priceHistory.reverse()})),unavailable:ids.filter(id=>!items.some(i=>i.id===id))});
}));
router.get(
  '/',
  validate(filterSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const { q, categoryId, condition, minPrice, maxPrice, isFree, sort } = req.query;
    const where = listingWhere(req.query);
    if (q) where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
    if (categoryId) where.categoryId = +categoryId;
    if (condition) where.condition = condition;
    if (isFree === 'true') where.isFree = true;
    const orderBy =
      sort === 'price_asc' ? { price: 'asc' }
      : sort === 'price_desc' ? { price: 'desc' }
      : sort === 'newest' ? { createdAt: 'desc' }
      : [{ boostedUntil: 'desc' }, { createdAt: 'desc' }];

    const [items, total] = await Promise.all([
      prisma.listing.findMany({ where, include: listingInclude, orderBy, skip, take: limit }),
      prisma.listing.count({ where }),
    ]);
    res.json(pagedResult(items, total, page, limit));
  })
);

// GET /api/v1/listings/recommended — gợi ý theo sở thích (danh mục đã lưu/xem), fallback: xem nhiều nhất
router.get(
  '/recommended',
  asyncHandler(async (req, res) => {
    const limit = Math.min(+(req.query.limit || 8), 20);
    let categoryIds = [];
    // nếu đăng nhập: lấy top danh mục từ tin đã lưu
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { status: true, sessionVersion: true } });
        if (payload.purpose !== 'access' || !user || user.status !== 'ACTIVE' || (payload.sessionVersion ?? 0) !== user.sessionVersion) throw new Error('Revoked session');
        const favs = await prisma.favorite.findMany({
          where: { userId: payload.sub },
          include: { listing: { select: { categoryId: true } } },
          take: 20,
        });
        const counts = {};
        favs.forEach((f) => { counts[f.listing.categoryId] = (counts[f.listing.categoryId] || 0) + 1; });
        categoryIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => +c);
      } catch { /* token không hợp lệ -> bỏ qua */ }
    }
    const where = { status: 'ACTIVE' };
    if (categoryIds.length) where.categoryId = { in: categoryIds };
    const items = await prisma.listing.findMany({
      where, include: listingInclude,
      orderBy: [{ boostedUntil: 'desc' }, { views: 'desc' }],
      take: limit,
    });
    res.json({ items, basedOn: categoryIds.length ? 'favorites' : 'popular' });
  })
);

// POST /api/v1/listings/:id/offers — gửi yêu cầu trả giá (hiệu lực 24h)
const OFFER_TTL_HOURS = 24;
router.post(
  '/:id/offers',
  auth,
  verifiedAccount,
  accountLimit('CREATE_OFFER', 20, 3600000),
  validate(z.object({
    offeredPrice: z.number().int().min(1000, 'Giá đề xuất tối thiểu 1.000đ').max(10_000_000_000),
    message: z.string().trim().max(500).optional(),
    shipMethod: z.enum(['NOLA_SHIP', 'MEETUP']).default('NOLA_SHIP'),
  })),
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: +req.params.id } });
    if (!listing || listing.status !== 'ACTIVE')
      return res.status(404).json({ message: 'Tin đăng không khả dụng' });
    if (listing.sellerId === req.user.id)
      return res.status(400).json({ message: 'Không thể trả giá tin của chính mình' });
    if (req.body.offeredPrice >= listing.price)
      return res.status(400).json({ message: 'Giá đề xuất phải thấp hơn giá niêm yết' });

    const offer = await prisma.priceOffer.create({
      data: {
        listingId: listing.id,
        buyerId: req.user.id,
        offeredPrice: req.body.offeredPrice,
        message: req.body.message,
        shipMethod: req.body.shipMethod,
        expiresAt: new Date(Date.now() + OFFER_TTL_HOURS * 3600 * 1000),
      },
      include: { listing: { select: { title: true } }, buyer: { select: { fullName: true } } },
    });
    await notify(null, listing.sellerId, 'OFFER', 'Có yêu cầu trả giá mới',
      `${offer.buyer.fullName} trả giá ${req.body.offeredPrice.toLocaleString('vi-VN')}đ cho "${listing.title}"`,
      { offerId: offer.id });
    res.status(201).json({ message: 'Đã gửi yêu cầu, hiệu lực 24 giờ', offer });
  })
);

// GET /api/v1/listings/:id/related — "có thể bạn cũng thích": cùng danh mục, giá tương đương
router.get(
  '/:id/related',
  asyncHandler(async (req, res) => {
    const limit = Math.min(+(req.query.limit || 8), 20);
    const cur = await prisma.listing.findUnique({ where: { id: +req.params.id } });
    if (!cur) return res.status(404).json({ message: 'Tin đăng không tồn tại' });
    const low = Math.floor(cur.price * 0.5), high = Math.ceil(cur.price * 1.5) || 1000000000;
    const items = await prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        id: { not: cur.id },
        categoryId: cur.categoryId,
        price: { gte: cur.isFree ? 0 : low, lte: cur.isFree ? 0 : high },
      },
      include: listingInclude,
      orderBy: [{ views: 'desc' }],
      take: limit,
    });
    res.json({ items });
  })
);

// GET /api/v1/listings/:id — tăng views
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({
      where: { id: +req.params.id },
      include: listingInclude,
    });
    if (!listing || listing.status !== 'ACTIVE')
      return res.status(404).json({ message: 'Tin đăng không tồn tại' });
    await prisma.listing.update({
      where: { id: listing.id },
      data: { views: { increment: 1 } },
    });
    res.json({ ...listing, views: listing.views + 1 });
  })
);

const listingSchema = z.object({
  categoryId: z.number().int(),
  title: z.string().trim().min(10, 'Tiêu đề tối thiểu 10 ký tự').max(150),
  description: z.string().trim().min(20, 'Mô tả tối thiểu 20 ký tự').max(5000),
  price: z.number().int().min(0).max(10_000_000_000, 'Giá tối đa 10 tỷ'),
  originalPrice: z.number().int().min(0).max(10_000_000_000).optional(),
  condition: z.enum(['NEW', 'LIKE_NEW', 'USED_GOOD', 'USED_FAIR', 'FOR_PARTS']).default('USED_GOOD'),
  isFree: z.boolean().default(false),
  city: z.string().trim().max(100).default(''),
  deliveryMethod: z.enum(['ANY', 'MEETUP', 'DELIVERY']).default('ANY'),
  specifications: z.record(z.string().trim().max(250)).default({}),
  images: z.array(httpUrl('Ảnh')).min(1, 'Cần ít nhất 1 hình ảnh').max(10),
});

// POST /api/v1/listings — người bán đăng tin (chờ duyệt)
router.post(
  '/',
  auth,
  requireRole('SELLER'),
  verifiedAccount,
  accountLimit('CREATE_LISTING', 10, 86400000),
  validate(listingSchema),
  asyncHandler(async (req, res) => {
    const { images, ...data } = req.body;
    if (data.isFree) data.price = 0;
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return res.status(400).json({ message: 'Danh mục không tồn tại' });
    validateSpecifications(category.slug, data.specifications);
    const listing = await prisma.listing.create({
      data: {
        ...data,
        sellerId: req.user.id,
        status: 'PENDING_REVIEW',
        images: { create: images.map((url, i) => ({ url, sortOrder: i })) },
        priceHistory: { create: { price: data.price } },
      },
      include: listingInclude,
    });
    res.status(201).json({ message: 'Đăng tin thành công, đang chờ kiểm duyệt', listing });
  })
);

// PATCH /api/v1/listings/:id — sửa tin của chính mình
router.patch(
  '/:id',
  auth,
  requireRole('SELLER'),
  validate(listingSchema.partial()),
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: +req.params.id } });
    if (!listing || listing.sellerId !== req.user.id)
      return res.status(404).json({ message: 'Không tìm thấy tin đăng' });
    const { images, ...data } = req.body;
    if (data.isFree) data.price = 0;
    const category = await prisma.category.findUnique({ where: { id: data.categoryId || listing.categoryId } });
    if (!category) return res.status(400).json({ message: 'Danh mục không tồn tại' });
    validateSpecifications(category.slug, data.specifications || (data.categoryId !== undefined && data.categoryId !== listing.categoryId ? {} : listing.specifications));
    if (data.categoryId !== undefined && data.categoryId !== listing.categoryId && !data.specifications) data.specifications = {};
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.listing.updateMany({ where: { id: listing.id, sellerId: req.user.id, status: { in: ['ACTIVE', 'HIDDEN', 'DRAFT', 'PENDING_REVIEW', 'REJECTED'] }, updatedAt: listing.updatedAt }, data: { ...data, status: 'PENDING_REVIEW' } });
      if (!changed.count) throw Object.assign(new Error('Tin đang được giữ/bán hết hoặc vừa thay đổi, không thể sửa'), { status: 409 });
      if (data.price !== undefined && data.price !== listing.price) await tx.priceHistory.create({ data: { listingId: listing.id, price: data.price } });
      if (images) {
        await tx.listingImage.deleteMany({ where: { listingId: listing.id } });
        await tx.listingImage.createMany({
          data: images.map((url, i) => ({ listingId: listing.id, url, sortOrder: i })),
        });
      }
      return tx.listing.findUnique({
        where: { id: listing.id },
        include: listingInclude,
      });
    });
    res.json(updated);
  })
);

// PATCH /api/v1/listings/:id/visibility — ẩn / hiện tin
router.patch(
  '/:id/visibility',
  auth,
  requireRole('SELLER'),
  validate(z.object({ status: z.enum(['ACTIVE', 'HIDDEN']) })),
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: +req.params.id } });
    if (!listing || listing.sellerId !== req.user.id)
      return res.status(404).json({ message: 'Không tìm thấy tin đăng' });
    if (!['ACTIVE', 'HIDDEN'].includes(listing.status))
      return res.status(400).json({ message: 'Chỉ có thể ẩn hoặc hiện tin đã được duyệt' });
    const updated = await prisma.listing.updateMany({
      where: { id: listing.id, sellerId: req.user.id, status: { in: ['ACTIVE', 'HIDDEN'] } },
      data: { status: req.body.status },
    });
    if (!updated.count) return res.status(409).json({ message: 'Tin đang được giữ hoặc đã đổi trạng thái' });
    res.json({ id: listing.id, status: req.body.status });
  })
);

// POST /api/v1/listings/:id/boost — đẩy tin (trừ phí ví)
router.post(
  '/:id/boost',
  auth,
  requireRole('SELLER'),
  asyncHandler(async (req, res) => {
    const { applyWallet } = require('../utils');
    const listing = await prisma.listing.findUnique({ where: { id: +req.params.id } });
    if (!listing || listing.sellerId !== req.user.id)
      return res.status(404).json({ message: 'Không tìm thấy tin đăng' });
    const feeCfg = await prisma.feeConfig.findFirst({
      where: { kind: 'PLATFORM_TXN', name: 'Phí đẩy tin', isActive: true },
    });
    const fee = feeCfg?.amount ?? 10000;
    await prisma.$transaction(async (tx) => {
      await applyWallet(tx, req.user.id, 'PLATFORM_FEE', -fee, `BOOST-${listing.id}`, 'Phí đẩy tin nổi bật 24h');
      await tx.listing.update({
        where: { id: listing.id },
        data: { boostedUntil: new Date(Date.now() + 24 * 3600 * 1000) },
      });
    });
    res.json({ message: `Đã đẩy tin 24h (phí ${fee.toLocaleString('vi-VN')}đ)` });
  })
);

// DELETE /api/v1/listings/:id — xoá mềm
router.delete(
  '/:id',
  auth,
  requireRole('SELLER'),
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({ where: { id: +req.params.id } });
    if (!listing || listing.sellerId !== req.user.id)
      return res.status(404).json({ message: 'Không tìm thấy tin đăng' });
    const removed = await prisma.listing.updateMany({
      where: { id: listing.id, sellerId: req.user.id, status: { in: ['ACTIVE','HIDDEN','DRAFT','PENDING_REVIEW','REJECTED'] } },
      data: { status: 'DELETED' },
    });
    if (!removed.count) return res.status(409).json({ message: 'Không thể xóa tin đang được giữ hoặc đã bán' });
    res.json({ message: 'Đã xoá tin đăng' });
  })
);

// POST /api/v1/listings/:id/favorite — lưu / bỏ lưu tin
router.post('/:id/favorite', auth, asyncHandler(async (req, res) => {
  const listingId = +req.params.id;
  const fav = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId: req.user.id, listingId } },
  });
  if (fav) {
    await prisma.favorite.delete({ where: { userId_listingId: { userId: req.user.id, listingId } } });
    return res.json({ favorited: false });
  }
  await prisma.favorite.create({ data: { userId: req.user.id, listingId } });
  res.json({ favorited: true });
}));

// GET /api/v1/listings/me/favorites
router.get('/me/favorites', auth, asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { userId: req.user.id };
  const [items, total] = await Promise.all([
    prisma.favorite.findMany({
      where, include: { listing: { include: listingInclude } },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.favorite.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

// ---- Kiểm duyệt (admin nội dung) ----
// GET /api/v1/admin/listings/pending
router.get(
  '/admin/pending',
  auth,
  requireRole('ADMIN_CONTENT'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const where = { status: 'PENDING_REVIEW' };
    if (req.query.q) where.OR = [{ title: { contains: req.query.q, mode: 'insensitive' } }, { seller: { fullName: { contains: req.query.q, mode: 'insensitive' } } }];
    const [items, total] = await Promise.all([
      prisma.listing.findMany({ where, include: listingInclude, orderBy: { createdAt: 'asc' }, skip, take: limit }),
      prisma.listing.count({ where }),
    ]);
    res.json(pagedResult(items, total, page, limit));
  })
);

// PATCH /api/v1/admin/listings/:id/moderate — duyệt / từ chối tin
router.patch(
  '/admin/:id/moderate',
  auth,
  requireRole('ADMIN_CONTENT'),
  validate(z.object({
    action: z.enum(['APPROVE', 'REJECT']),
    reason: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    const { action, reason } = req.body;
    const listing = await prisma.listing.findUnique({ where: { id: +req.params.id } });
    if (!listing) return res.status(404).json({ message: 'Không tìm thấy tin đăng' });
    const updated = await prisma.$transaction(async tx => {
    const changed = await tx.listing.updateMany({
      where: { id: listing.id, status: 'PENDING_REVIEW' },
      data: action === 'APPROVE'
        ? { status: 'ACTIVE', rejectReason: null }
        : { status: 'REJECTED', rejectReason: reason || 'Vi phạm quy định đăng tin' },
    });
    if (!changed.count) throw Object.assign(new Error('Chỉ duyệt tin đang chờ kiểm duyệt'), { status: 409 });
    await tx.auditLog.create({ data: { adminId: req.user.id, action: 'MODERATE_LISTING', target: `listing:${listing.id}`, detail: { action, reason: reason || '' } } });
    if (action === 'APPROVE') await require('../services/saved-searches').notifyMatchingSearches(listing.id, tx);
    await notify(
      tx, listing.sellerId, 'SYSTEM',
      action === 'APPROVE' ? 'Tin đăng đã được duyệt' : 'Tin đăng bị từ chối',
      `Tin "${listing.title}" ${action === 'APPROVE' ? 'đã được duyệt và hiển thị.' : 'bị từ chối: ' + (reason || '')}`
    );
    return tx.listing.findUnique({ where: { id: listing.id } });
    }, { timeout: 15000 });
    res.json(updated);
  })
);

router.get('/:id/price-history', asyncHandler(async (req, res) => {
  const listing = await prisma.listing.findFirst({ where: { id: +req.params.id, status: 'ACTIVE' } });
  if (!listing) return res.status(404).json({ message: 'Tin không khả dụng' });
  const history = await prisma.priceHistory.findMany({ where: { listingId: listing.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 300 });
  res.json(history.reverse());
}));
module.exports = router;
