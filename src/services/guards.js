const prisma = require('../prisma');
const { asyncHandler } = require('../middleware');
function accountLimit(action, max, windowMs) {
  return asyncHandler(async (req, res, next) => {
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const allowed = await prisma.$transaction(async tx => {
      await tx.actionQuota.upsert({ where: { userId_action_windowStart: { userId: req.user.id, action, windowStart } }, create: { userId: req.user.id, action, windowStart }, update: {} });
      return tx.actionQuota.updateMany({ where: { userId: req.user.id, action, windowStart, count: { lt: max } }, data: { count: { increment: 1 } } });
    });
    if (!allowed.count) { res.set('Retry-After', String(Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000))); return res.status(429).json({ message: 'Đã đạt giới hạn thao tác. Vui lòng thử lại sau.' }); }
    next();
  });
}
function verifiedAccount(req, res, next) {
  if (!req.user.emailVerified && !req.user.idVerified) return res.status(403).json({ message: 'Hãy xác nhận email hoặc danh tính trước khi đặt hàng/đăng tin.' });
  next();
}
module.exports = { accountLimit, verifiedAccount };
