// Chat: tin nhắn giữa người mua & người bán (polling; nâng cấp websocket khi cần realtime)
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, validate } = require('../middleware');
const { notify } = require('../utils');
const { accountLimit } = require('../services/guards');

const router = express.Router();
router.use(auth);

// GET /api/v1/chat/conversations — danh sách hội thoại (người đã từng nhắn)
router.get('/conversations', asyncHandler(async (req, res) => {
  const me = req.user.id;
  const msgs = await prisma.message.findMany({
    where: { OR: [{ senderId: me }, { receiverId: me }] },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { id: true, fullName: true, avatarUrl: true } },
      receiver: { select: { id: true, fullName: true, avatarUrl: true } },
      // listingId không có relation nên lấy title riêng ở dưới nếu cần
    },
    take: 200,
  });
  const map = new Map();
  for (const m of msgs) {
    const otherId = m.senderId === me ? m.receiverId : m.senderId;
    const key = `${otherId}:${m.listingId || 0}`;
    if (!map.has(key)) {
      const other = m.senderId === me ? m.receiver : m.sender;
      map.set(key, { user: other, listingId: m.listingId, lastMessage: m.body, at: m.createdAt });
    }
  }
  // Đếm tin chưa đọc theo từng hội thoại
  const result = [];
  for (const [key, c] of map) {
    const [otherId] = key.split(':').map(Number);
    const unread = await prisma.message.count({
      where: { senderId: otherId, receiverId: me, isRead: false },
    });
    result.push({ ...c, unread });
  }
  res.json(result);
}));

// GET /api/v1/chat/with/:userId?listingId= — lịch sử chat với 1 người
router.get('/with/:userId', asyncHandler(async (req, res) => {
  const me = req.user.id;
  const other = +req.params.userId;
  const where = {
    OR: [
      { senderId: me, receiverId: other },
      { senderId: other, receiverId: me },
    ],
  };
  if (req.query.listingId) where.listingId = +req.query.listingId;
  const messages = await prisma.message.findMany({
    where, orderBy: { createdAt: 'asc' }, take: 100,
  });
  // Đánh dấu đã đọc
  await prisma.message.updateMany({
    where: { senderId: other, receiverId: me, isRead: false },
    data: { isRead: true },
  });
  res.json(messages);
}));

// POST /api/v1/chat/messages — gửi tin nhắn
router.post(
  '/messages',
  accountLimit('SEND_MESSAGE', 30, 60000),
  validate(z.object({
    receiverId: z.number().int(),
    body: z.string().trim().min(1, 'Tin nhắn không được bỏ trống').max(2000),
    listingId: z.number().int().optional(),
    orderId: z.number().int().optional(),
  })),
  asyncHandler(async (req, res) => {
    if (req.body.receiverId === req.user.id)
      return res.status(400).json({ message: 'Không thể tự nhắn cho chính mình' });
    const receiver = await prisma.user.findUnique({ where: { id: req.body.receiverId } });
    if (!receiver || receiver.status !== 'ACTIVE')
      return res.status(404).json({ message: 'Người nhận không tồn tại' });
    const blocked = await prisma.userBlock.findFirst({ where: { OR: [{ blockerId: req.user.id, blockedId: receiver.id }, { blockerId: receiver.id, blockedId: req.user.id }] } });
    if (blocked) return res.status(403).json({ message: 'Không thể nhắn tin do chặn liên lạc' });
    if (req.body.orderId) {
      const order = await prisma.order.findFirst({ where: { id: req.body.orderId, OR: [{ buyerId: req.user.id, sellerId: receiver.id }, { buyerId: receiver.id, sellerId: req.user.id }] } });
      if (!order) return res.status(403).json({ message: 'Đơn không thuộc hai người trong hội thoại' });
    }

    const msg = await prisma.message.create({
      data: { ...req.body, senderId: req.user.id },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    const sender = await prisma.user.findUnique({ where: { id: req.user.id }, select: { fullName: true } });
    await notify(null, req.body.receiverId, 'SYSTEM', `Tin nhắn mới từ ${sender.fullName}`,
      req.body.body.slice(0, 120), { senderId: req.user.id });
    res.status(201).json(msg);
  })
);

module.exports = router;

router.get('/blocks', asyncHandler(async (req, res) => {
  const blocks = await prisma.userBlock.findMany({ where: { blockerId: req.user.id } });
  const users = await prisma.user.findMany({ where: { id: { in: blocks.map(b => b.blockedId) } }, select: { id: true, fullName: true, avatarUrl: true } });
  res.json(users);
}));
router.post('/blocks/:id', accountLimit('BLOCK_USER', 20, 3600000), asyncHandler(async (req, res) => {
  const blockedId = +req.params.id;
  if (!Number.isSafeInteger(blockedId) || blockedId <= 0 || blockedId === req.user.id) return res.status(400).json({ message: 'Tài khoản cần chặn không hợp lệ' });
  if (!await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } })) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
  await prisma.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: req.user.id, blockedId } }, create: { blockerId: req.user.id, blockedId }, update: {} });
  res.json({ message: 'Đã chặn liên lạc' });
}));
router.delete('/blocks/:id', asyncHandler(async (req, res) => {
  const blockedId=z.coerce.number().int().positive().parse(req.params.id);
  await prisma.userBlock.deleteMany({ where: { blockerId: req.user.id, blockedId } });
  res.json({ message: 'Đã bỏ chặn' });
}));
