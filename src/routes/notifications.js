// Notifications: trung tâm thông báo
const express = require('express');
const prisma = require('../prisma');
const { asyncHandler, auth } = require('../middleware');
const { paginate, pagedResult } = require('../utils');

const router = express.Router();
router.use(auth);

// GET /api/v1/notifications?unread=true
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { userId: req.user.id };
  if (req.query.unread === 'true') where.isRead = false;
  const [items, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.notification.count({ where }),
  ]);
  const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
  res.json({ ...pagedResult(items, total, page, limit), unreadCount });
}));

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const n = await prisma.notification.findFirst({ where: { id: +req.params.id, userId: req.user.id } });
  if (!n) return res.status(404).json({ message: 'Không tìm thấy thông báo' });
  res.json(await prisma.notification.update({ where: { id: n.id }, data: { isRead: true } }));
}));

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ message: 'Đã đánh dấu đọc tất cả' });
}));

module.exports = router;
