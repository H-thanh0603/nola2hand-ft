// Admin: quản lý tài khoản người dùng — khóa/mở khóa, duyệt xác minh, phân quyền
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult, notify } = require('../utils');
const { protectAdminTarget } = require('../services/admin-permissions');

const router = express.Router();
router.use(auth, requireRole('ADMIN_FINANCE', 'ADMIN_CONTENT'));

// GET /api/v1/admin/users?q=&status=&role=
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.q) {
    where.OR = [
      { fullName: { contains: req.query.q, mode: 'insensitive' } },
      { email: { contains: req.query.q, mode: 'insensitive' } },
      { phone: { contains: req.query.q } },
    ];
  }
  if (req.query.role) where.roles = { some: { role: { name: req.query.role } } };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, fullName: true, email: true, phone: true, avatarUrl: true,
        status: true, isVerified: true, idVerified: true, banReason: true, createdAt: true,
        roles: { include: { role: true } },
        _count: { select: { listings: true, ordersBuyer: true } },
      },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  const data = items.map((u) => ({ ...u, roles: u.roles.map((r) => r.role.name) }));
  res.json(pagedResult(data, total, page, limit));
}));

// GET /api/v1/admin/users/stats — 4 thẻ: tổng / đang hoạt động / chờ xác minh / đã khóa
router.get('/stats', asyncHandler(async (req, res) => {
  const [total, active, pending, banned] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'PENDING_VERIFICATION' } }),
    prisma.user.count({ where: { status: 'BANNED' } }),
  ]);
  res.json({ total, active, pendingVerification: pending, banned });
}));

// PATCH /api/v1/admin/users/:id/lock — khóa tài khoản + lý do
router.patch(
  '/:id/lock',
  validate(z.object({ reason: z.string().trim().min(1).max(500) })),
  asyncHandler(async (req, res) => {
    if (+req.params.id === req.user.id)
      return res.status(400).json({ message: 'Không thể tự khóa chính mình' });
    await prisma.$transaction(async tx => {
    await protectAdminTarget(tx, req.user, +req.params.id);
    const user = await tx.user.update({
      where: { id: +req.params.id },
      data: { status: 'BANNED', banReason: req.body.reason, bannedAt: new Date(), sessionVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: { adminId: req.user.id, action: 'LOCK_USER', target: `user:${user.id}`, detail: { reason: req.body.reason } },
    });
    await notify(tx, user.id, 'SYSTEM', 'Tài khoản của bạn đã bị khóa', `Lý do: ${req.body.reason}`);
    });
    res.json({ message: 'Đã khóa tài khoản' });
  })
);

// PATCH /api/v1/admin/users/:id/unlock — mở khóa (kèm lý do mở)
router.patch(
  '/:id/unlock',
  validate(z.object({ reason: z.string().trim().min(1).max(500) })),
  asyncHandler(async (req, res) => {
    await prisma.$transaction(async tx => {
    await protectAdminTarget(tx, req.user, +req.params.id);
    const user = await tx.user.update({
      where: { id: +req.params.id },
      data: { status: 'ACTIVE', banReason: null, bannedAt: null },
    });
    await tx.auditLog.create({
      data: { adminId: req.user.id, action: 'UNLOCK_USER', target: `user:${user.id}`, detail: { reason: req.body.reason } },
    });
    await notify(tx, user.id, 'SYSTEM', 'Tài khoản đã được mở khóa', req.body.reason);
    });
    res.json({ message: 'Đã mở khóa tài khoản' });
  })
);

// PATCH /api/v1/admin/users/:id/verify — duyệt xác minh danh tính
router.patch('/:id/verify', asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: +req.params.id },
    data: { idVerified: true },
  });
  await prisma.auditLog.create({
    data: { adminId: req.user.id, action: 'VERIFY_USER', target: `user:${user.id}` },
  });
  await notify(null, user.id, 'SYSTEM', 'Xác minh danh tính thành công',
    'Tài khoản của bạn đã được gắn huy hiệu đã xác thực ✓');
  res.json({ message: 'Đã duyệt xác minh' });
}));

// PATCH /api/v1/admin/users/:id/roles — gán / thu hồi role
router.patch(
  '/:id/roles',
  validate(z.object({ roles: z.array(z.enum(['BUYER', 'SELLER', 'ADMIN_FINANCE', 'ADMIN_CONTENT'])).min(1) })),
  asyncHandler(async (req, res) => {
    if (!req.user.canManageRoles || !req.user.roles.includes('ADMIN_FINANCE')) return res.status(403).json({ message: 'Cần quyền quản lý phân quyền riêng' });
    const userId = +req.params.id;
    if (!Number.isSafeInteger(userId) || userId <= 0) return res.status(400).json({ message: 'Người dùng không hợp lệ' });
    if (userId === req.user.id) return res.status(403).json({ message: 'Không được thay đổi vai trò của chính mình' });
    const roles = await prisma.role.findMany({ where: { name: { in: req.body.roles } } });
    await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(1502026)');
      const executor = await tx.user.findUnique({ where: { id: req.user.id }, include: { roles: { include: { role: true } } } });
      if (!executor || executor.status !== 'ACTIVE' || !executor.canManageRoles || !executor.roles.some(r => r.role.name === 'ADMIN_FINANCE')) throw Object.assign(new Error('Quyền quản lý phân quyền đã bị thu hồi'), { status: 403 });
      const target = await tx.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
      if (!target) throw Object.assign(new Error('Không tìm thấy tài khoản'), { status: 404 });
      const oldFinance = target.roles.some(r => r.role.name === 'ADMIN_FINANCE');
      if (oldFinance && !req.body.roles.includes('ADMIN_FINANCE')) {
        const remaining = await tx.user.count({ where: { id: { not: userId }, status: 'ACTIVE', roles: { some: { role: { name: 'ADMIN_FINANCE' } } } } });
        if (!remaining) throw Object.assign(new Error('Phải giữ ít nhất một admin tài chính hoạt động'), { status: 409 });
        if (target.canManageRoles) {
          const managers = await tx.user.count({ where: { id: { not: userId }, status: 'ACTIVE', canManageRoles: true, roles: { some: { role: { name: 'ADMIN_FINANCE' } } } } });
          if (!managers) throw Object.assign(new Error('Phải giữ ít nhất một người quản lý phân quyền'), { status: 409 });
        }
      }
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({ data: roles.map((r) => ({ userId, roleId: r.id })) });
      if (req.body.roles.includes('SELLER')) {
        const has = await tx.sellerProfile.findUnique({ where: { userId } });
        if (!has) {
          const u = await tx.user.findUnique({ where: { id: userId } });
          await tx.sellerProfile.create({ data: { userId, shopName: `Shop ${u.fullName}` } });
        }
      }
      await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 }, ...(!req.body.roles.includes('ADMIN_FINANCE') ? { canManageRoles: false } : {}) } });
      await tx.auditLog.create({ data: { adminId: req.user.id, action: 'SET_ROLES', target: `user:${userId}`, detail: { roles: req.body.roles } } });
    });
    res.json({ message: 'Đã cập nhật phân quyền', roles: req.body.roles });
  })
);

module.exports = router;
