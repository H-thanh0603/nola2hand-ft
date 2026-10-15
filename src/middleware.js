// Shared middleware: JWT auth, RBAC, zod validation, error handling
const jwt = require('jsonwebtoken');
const prisma = require('./prisma');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Đính kèm req.user { id, roles[] } từ Bearer token */
const auth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Thiếu token đăng nhập' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose !== 'access')
      return res.status(401).json({ message: 'Token không dùng để đăng nhập' });
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });
    if (!user || user.status !== 'ACTIVE')
      return res.status(401).json({ message: 'Tài khoản không còn hiệu lực' });
    if ((payload.sessionVersion ?? 0) !== (user.sessionVersion ?? 0))
      return res.status(401).json({ message: 'Phiên đã bị thu hồi. Hãy đăng nhập lại.' });
    req.user = { id: user.id, roles: user.roles.map((r) => r.role.name), canManageRoles: user.canManageRoles === true, emailVerified: Boolean(user.emailVerifiedAt), idVerified: user.idVerified === true };
    next();
  } catch {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
});

/** Cho phép truy cập nếu user có ít nhất 1 trong các role yêu cầu */
const requireRole = (...roles) => (req, res, next) => {
  const ok = (req.user?.roles || []).some((r) => roles.includes(r));
  if (!ok) return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này' });
  next();
};

/** Validate req.body / query / params bằng zod schema */
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', details });
  }
  req[source] = result.data;
  next();
};

/** Chuẩn hoá lỗi trả về */
 // eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(err);
  if (err.name === 'ZodError') return res.status(400).json({ message: 'Dữ liệu lọc không hợp lệ', details: err.issues });
  if (err.code === 'P2002')
    return res.status(409).json({ message: 'Dữ liệu đã tồn tại (trùng lặp)' });
  if (err.code === 'P2025')
    return res.status(404).json({ message: 'Không tìm thấy dữ liệu' });
  res.status(err.status || 500).json({
    message: err.message || 'Lỗi hệ thống, vui lòng thử lại sau',
  });
};

module.exports = { asyncHandler, auth, requireRole, validate, errorHandler };
