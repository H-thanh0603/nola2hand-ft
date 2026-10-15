// Users: hồ sơ cá nhân, địa chỉ, lên đời người bán, xem trang cá nhân
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, validate } = require('../middleware');
const { paginate, pagedResult } = require('../utils');

const router = express.Router();

// GET /api/v1/users/me/profile (đầy đủ)
router.get(
  '/me/profile',
  auth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { roles: { include: { role: true } }, sellerProfile: true, addresses: true },
    });
    const { passwordHash, passwordResetTokenHash, passwordResetExpiresAt, emailVerificationTokenHash, emailVerificationExpiresAt, ...safe } = user;
    res.json({ ...safe, roles: user.roles.map((r) => r.role.name) });
  })
);

const { phoneVN, httpUrl } = require('../validators');
const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: phoneVN.max(20).optional(),
  avatarUrl: httpUrl('Ảnh đại diện').optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  bio: z.string().trim().max(500).optional(),
});
// PATCH /api/v1/users/me
router.patch(
  '/me',
  auth,
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    const { passwordHash, passwordResetTokenHash, passwordResetExpiresAt, emailVerificationTokenHash, emailVerificationExpiresAt, ...safe } = user;
    res.json(safe);
  })
);

// POST /api/v1/users/me/become-seller — mở kênh người bán
router.post(
  '/me/become-seller',
  auth,
  validate(z.object({ shopName: z.string().trim().min(2).max(100), phone: phoneVN.max(20).optional(), city: z.string().trim().min(1).max(100).optional(), street: z.string().trim().min(1).max(255).optional() })),
  asyncHandler(async (req, res) => {
    if (req.user.roles.includes('SELLER'))
      return res.status(400).json({ message: 'Bạn đã là người bán' });
    const sellerRole = await prisma.role.findUnique({ where: { name: 'SELLER' } });
    const profile = await prisma.$transaction(async (tx) => {
      await tx.userRole.create({ data: { userId: req.user.id, roleId: sellerRole.id } });
      const p = await tx.sellerProfile.create({
        data: { userId: req.user.id, shopName: req.body.shopName },
      });
      const me = await tx.user.findUnique({ where: { id: req.user.id } });
      if (req.body.phone) await tx.user.update({ where: { id: req.user.id }, data: { phone: req.body.phone } });
      if (req.body.city && req.body.street) {
        const count = await tx.address.count({ where: { userId: req.user.id } });
        await tx.address.create({
          data: { userId: req.user.id, label: 'Lấy hàng', receiver: me.fullName, phone: req.body.phone || me.phone || '', street: req.body.street, city: req.body.city, isDefault: count === 0 },
        });
      }
      return p;
    });
    res.status(201).json({ message: 'Mở kênh người bán thành công', profile });
  })
);

// ---- Sổ địa chỉ ----
const addressSchema = z.object({
  label: z.string().trim().min(1).max(50),
  receiver: z.string().trim().min(1).max(100),
  phone: phoneVN.max(20),
  street: z.string().trim().min(1),
  ward: z.string().trim().optional(),
  district: z.string().trim().optional(),
  city: z.string().trim().min(1),
  isDefault: z.boolean().optional(),
});
router.get(
  '/me/addresses',
  auth,
  asyncHandler(async (req, res) => {
    res.json(await prisma.address.findMany({ where: { userId: req.user.id }, orderBy: { isDefault: 'desc' } }));
  })
);
router.post(
  '/me/addresses',
  auth,
  validate(addressSchema),
  asyncHandler(async (req, res) => {
    const data = { ...req.body, userId: req.user.id };
    if (data.isDefault)
      await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
    res.status(201).json(await prisma.address.create({ data }));
  })
);
router.delete(
  '/me/addresses/:id',
  auth,
  asyncHandler(async (req, res) => {
    const addr = await prisma.address.findFirst({
      where: { id: +req.params.id, userId: req.user.id },
    });
    if (!addr) return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    await prisma.address.delete({ where: { id: addr.id } });
    res.json({ message: 'Đã xoá địa chỉ' });
  })
);

// GET /api/v1/users/:id — trang cá nhân công khai + đánh giá tóm tắt
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: +req.params.id },
      select: {
        id: true, fullName: true, avatarUrl: true, isVerified: true, createdAt: true,
        sellerProfile: true,
        _count: { select: { listings: true } },
      },
    });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    const { page, limit, skip } = paginate(req.query, { limit: 5 });
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { revieweeId: user.id },
        include: { reviewer: { select: { id: true, fullName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: limit,
      }),
      prisma.review.count({ where: { revieweeId: user.id } }),
    ]);
    res.json({ user, ...pagedResult(reviews, total, page, limit) });
  })
);

module.exports = router;
