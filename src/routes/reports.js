// Reports: báo cáo vi phạm nội dung — user gửi, admin nội dung xử lý
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult, notify } = require('../utils');
const { accountLimit } = require('../services/guards');

const router = express.Router();

// POST /api/v1/reports — người dùng báo cáo vi phạm
router.post(
  '/',
  auth,
  accountLimit('CREATE_REPORT', 10, 86400000),
  validate(z.object({
    targetType: z.enum(['COMMENT', 'LISTING_DESC', 'MESSAGE', 'AVATAR', 'LISTING']),
    targetId: z.number().int(),
    targetUserId: z.number().int().optional(),
    reason: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
  })),
  asyncHandler(async (req, res) => {
    const report = await prisma.report.create({
      data: { ...req.body, reporterId: req.user.id },
    });
    res.status(201).json({ message: 'Đã gửi báo cáo, cảm ơn bạn', report });
  })
);

// GET /api/v1/admin/reports — danh sách (admin nội dung)
router.get('/admin/all', auth, requireRole('ADMIN_CONTENT'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.status) {
    if (!['NEW', 'REVIEWING', 'RESOLVED', 'DISMISSED'].includes(req.query.status))
      return res.status(400).json({ message: 'Trạng thái báo cáo không hợp lệ (NEW/REVIEWING/RESOLVED/DISMISSED)' });
    where.status = req.query.status;
  }
  if (req.query.targetType) where.targetType = req.query.targetType;
  if (req.query.q) where.OR = [{ reason: { contains: req.query.q, mode: 'insensitive' } }, { description: { contains: req.query.q, mode: 'insensitive' } }];
  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, fullName: true } },
        handler: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.report.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

// GET /api/v1/admin/reports/stats — 4 thẻ thống kê
router.get('/admin/stats', auth, requireRole('ADMIN_CONTENT'), asyncHandler(async (req, res) => {
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [isNew, reviewing, resolved, dismissed] = await Promise.all([
    prisma.report.count({ where: { status: 'NEW' } }),
    prisma.report.count({ where: { status: 'REVIEWING' } }),
    prisma.report.count({ where: { status: 'RESOLVED', updatedAt: { gte: monthStart } } }),
    prisma.report.count({ where: { status: 'DISMISSED', updatedAt: { gte: monthStart } } }),
  ]);
  res.json({ new: isNew, reviewing, resolvedThisMonth: resolved, dismissedThisMonth: dismissed });
}));

// PATCH /api/v1/admin/reports/:id — nhận xử lý / chốt kết quả
router.patch(
  '/admin/:id',
  auth,
  requireRole('ADMIN_CONTENT'),
  validate(z.object({
    status: z.enum(['REVIEWING', 'RESOLVED', 'DISMISSED']),
    resolution: z.string().trim().max(1000).optional(),
    action: z.enum(['NONE', 'WARN_USER', 'BAN_7_DAYS', 'BAN_PERMANENT', 'REMOVE_CONTENT']).default('NONE'),
  })),
  asyncHandler(async (req, res) => {
    const report = await prisma.report.findUnique({ where: { id: +req.params.id } });
    if (!report) return res.status(404).json({ message: 'Không tìm thấy báo cáo' });
    const { status, resolution, action } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.report.update({
        where: { id: report.id },
        data: { status, resolution, handlerId: req.user.id },
      });
      // Hành động với người vi phạm
      if (report.targetUserId && action !== 'NONE' && status === 'RESOLVED') {
        if (action === 'WARN_USER') {
          await notify(tx, report.targetUserId, 'REPORT', 'Cảnh cáo vi phạm',
            `Nội dung của bạn bị báo cáo: ${report.reason}. Vui lòng tuân thủ quy định cộng đồng.`);
        } else if (action === 'BAN_7_DAYS' || action === 'BAN_PERMANENT') {
          await require('../services/admin-permissions').protectAdminTarget(tx, req.user, report.targetUserId);
          await tx.user.update({
            where: { id: report.targetUserId },
            data: {
              status: 'BANNED',
              banReason: `${report.reason} (${action === 'BAN_7_DAYS' ? 'khóa 7 ngày' : 'khóa vĩnh viễn'})`,
              bannedAt: new Date(),
              sessionVersion: { increment: 1 },
            },
          });
          await tx.auditLog.create({
            data: {
              adminId: req.user.id, action,
              target: `user:${report.targetUserId}`,
              detail: { reportId: report.id, reason: report.reason },
            },
          });
        } else if (action === 'REMOVE_CONTENT' && report.targetType === 'LISTING') {
          await tx.listing.update({ where: { id: report.targetId }, data: { status: 'HIDDEN' } });
        }
      }
      return r;
    });

    await notify(null, report.reporterId, 'REPORT', 'Báo cáo của bạn đã được xử lý',
      `Báo cáo #${report.id} (${report.reason}): ${status}`, { reportId: report.id });
    res.json(updated);
  })
);

module.exports = router;
