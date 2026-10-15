// Auth: đăng ký / đăng nhập / refresh / quên mật khẩu
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, validate } = require('../middleware');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const { sendAccountEmail } = require('../services/mail');
const rateLimit = require('express-rate-limit');
const { emailField, phoneVN, passwordField } = require('../validators');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// Chống spam/dò OTP qua mail: tối đa 10 lượt/giờ cho mỗi thao tác mail.
const mailLimit = (max) => rateLimit({ windowMs: 60 * 60 * 1000, max, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Bạn thao tác quá nhiều, hãy thử lại sau 1 giờ' } });

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ sub: user.id, purpose: 'access', sessionVersion: user.sessionVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// OTP 6 số: lưu hash sha256, hiệu lực 10 phút, tối đa 5 lần sai/mã.
const OTP_TTL_MS = 10 * 60 * 1000, OTP_MAX_ATTEMPTS = 5;
const makeOtp = () => {
  const otp = String(crypto.randomInt(100000, 1000000));
  return { otp, hash: crypto.createHash('sha256').update(otp).digest('hex'), expiresAt: new Date(Date.now() + OTP_TTL_MS) };
};
const otpOf = (kind) => kind === 'verify'
  ? { hash: 'emailOtpHash', exp: 'emailOtpExpiresAt', att: 'emailOtpAttempts' }
  : { hash: 'passwordOtpHash', exp: 'passwordOtpExpiresAt', att: 'passwordOtpAttempts' };
// Trả {ok} hoặc {error}. Sai mã: +1 lượt; quá lượt/hết hạn: true (cần gửi lại).
async function consumeOtp(kind, email, otp) {
  const c = otpOf(kind);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user[c.hash]) return { error: 'Mã OTP chưa được gửi, hãy bấm Gửi lại' };
  if (user[c.att] >= OTP_MAX_ATTEMPTS || (user[c.exp] && user[c.exp] <= new Date()))
    return { error: 'Mã OTP đã hết hạn hoặc quá số lần thử, hãy bấm Gửi lại', expired: true };
  if (crypto.createHash('sha256').update(otp).digest('hex') !== user[c.hash]) {
    await prisma.user.update({ where: { id: user.id }, data: { [c.att]: { increment: 1 } } });
    return { error: `Mã OTP chưa đúng (còn ${OTP_MAX_ATTEMPTS - user[c.att] - 1} lượt)` };
  }
  await prisma.user.update({ where: { id: user.id }, data: { [c.hash]: null, [c.exp]: null, [c.att]: 0 } });
  return { ok: true, user };
}

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(100),
  email: emailField,
  password: passwordField(6),
  phone: phoneVN.max(20).optional(),
});

// POST /api/v1/auth/register
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { fullName, email, password, phone } = req.body;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: 'Email đã được đăng ký' });

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const v = makeOtp();
    const buyerRole = await prisma.role.findUnique({ where: { name: 'BUYER' } });

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { fullName, email, passwordHash, phone, wallet: { create: {} }, emailVerificationTokenHash: crypto.createHash('sha256').update(verificationToken).digest('hex'), emailVerificationExpiresAt: new Date(Date.now() + 86400_000), emailOtpHash: v.hash, emailOtpExpiresAt: v.expiresAt },
      });
      if (buyerRole) await tx.userRole.create({ data: { userId: u.id, roleId: buyerRole.id } });
      return u;
    });

    let delivery = 'FAILED';
    try { delivery = await sendAccountEmail(email, 'verify', verificationToken, v.otp); } catch { /* Resend is available without creating another account. */ }
    res.status(201).json({
      message: delivery === 'EMAIL' ? 'Đăng ký thành công, hãy kiểm tra email xác nhận' : delivery === 'LOCAL_OUTBOX' ? 'Đăng ký thành công. Thư xác nhận được lưu trong hộp thư development trên máy chủ.' : 'Tài khoản đã tạo. Chưa gửi được thư, hãy yêu cầu gửi lại xác nhận.',
      emailDelivery: delivery,
      token: signToken(user),
      user: { id: user.id, fullName, email },
    });
  })
);

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});

// POST /api/v1/auth/login
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (!user) return res.status(401).json({ message: 'Email hoặc mật khẩu chưa đúng' });
    if (user.status === 'BANNED')
      return res.status(403).json({ message: `Tài khoản đã bị khóa: ${user.banReason || ''}` });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Email hoặc mật khẩu chưa đúng' });

    res.json({
      token: signToken(user),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        roles: user.roles.map((r) => r.role.name),
        canManageRoles: user.canManageRoles === true,
      },
    });
  })
);

const googleSchema = z.object({ idToken: z.string().min(1) });
// POST /api/v1/auth/google — đăng nhập bằng Google (cần GOOGLE_CLIENT_ID trong .env)
router.post(
  '/google',
  validate(googleSchema),
  asyncHandler(async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID)
      return res.status(500).json({ message: 'Server chưa cấu hình GOOGLE_CLIENT_ID' });
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: req.body.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: 'Google token không hợp lệ' });
    }
    const { sub: googleId, email, name, picture } = payload;
    if (!email || !payload.email_verified) return res.status(401).json({ message: 'Google chưa xác minh email' });

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
      include: { roles: { include: { role: true } } },
    });
    if (user?.googleId && user.googleId !== googleId)
      return res.status(401).json({ message: 'Email đã liên kết với tài khoản Google khác' });
    if (user && !user.googleId) {
      // đã có tài khoản email -> liên kết Google
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, isVerified: true, emailVerifiedAt: new Date(), avatarUrl: user.avatarUrl || picture },
        include: { roles: { include: { role: true } } },
      });
    }
    if (!user) {
      const buyerRole = await prisma.role.findUnique({ where: { name: 'BUYER' } });
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            fullName: name || email.split('@')[0],
            email,
            googleId,
            passwordHash: await bcrypt.hash(crypto.randomUUID(), 10),
            isVerified: true,
            emailVerifiedAt: new Date(),
            avatarUrl: picture,
            wallet: { create: {} },
          },
        });
        if (buyerRole) await tx.userRole.create({ data: { userId: u.id, roleId: buyerRole.id } });
        return u;
      });
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: { roles: { include: { role: true } } },
      });
    }
    if (user.status === 'BANNED')
      return res.status(403).json({ message: 'Tài khoản đã bị khóa' });

    res.json({
      token: signToken(user),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        roles: user.roles.map((r) => r.role.name),
        canManageRoles: user.canManageRoles === true,
      },
    });
  })
);

// GET /api/v1/auth/me
router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        roles: { include: { role: true } },
        sellerProfile: true,
        wallet: { select: { balance: true, pendingBalance: true } },
      },
    });
    const { passwordHash, passwordResetTokenHash, passwordResetExpiresAt, emailVerificationTokenHash, emailVerificationExpiresAt, ...safe } = user;
    res.json({ ...safe, roles: user.roles.map((r) => r.role.name) });
  })
);

const forgotSchema = z.object({ email: emailField });
// POST /api/v1/auth/forgot-password
// The raw token must be delivered by the configured email provider, never in this response.
router.post(
  '/forgot-password',
  mailLimit(10),
  validate(forgotSchema),
  asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production' && (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM))
      return res.status(503).json({ message: 'Dịch vụ email chưa được cấu hình' });
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const passwordResetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const o = makeOtp();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash,
          passwordResetExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          passwordOtpHash: o.hash, passwordOtpExpiresAt: o.expiresAt, passwordOtpAttempts: 0,
        },
      });
      try { await sendAccountEmail(user.email, 'reset', resetToken, o.otp); }
      catch { console.error('Không gửi được email đặt lại mật khẩu'); }
    }
    res.json({ message: process.env.RESEND_API_KEY && process.env.MAIL_FROM ? 'Yêu cầu đã được tiếp nhận. Nếu email tồn tại, hãy kiểm tra hộp thư để nhận link đặt lại mật khẩu.' : 'Nếu email tồn tại, thư được lưu trong hộp thư development trên máy chủ.' });
  })
);

const resetSchema = z.object({
  resetToken: z.string(),
  newPassword: passwordField(6, 'Mật khẩu mới'),
});
// POST /api/v1/auth/reset-password
router.post(
  '/reset-password',
  validate(resetSchema),
  asyncHandler(async (req, res) => {
    const { resetToken, newPassword } = req.body;
    const passwordResetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });
    if (!user) {
      return res.status(400).json({ message: 'Link đặt lại đã hết hạn' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const changed = await prisma.user.updateMany({
      where: { id: user.id, passwordResetTokenHash, passwordResetExpiresAt: { gt: new Date() } },
      data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null, sessionVersion: { increment: 1 } },
    });
    if (!changed.count) return res.status(400).json({ message: 'Link đã được sử dụng hoặc hết hạn' });
    res.json({ message: 'Đặt lại mật khẩu thành công' });
  })
);

router.get('/config', (req, res) => res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '', emailMode: process.env.RESEND_API_KEY ? 'EMAIL' : process.env.NODE_ENV === 'production' ? 'UNAVAILABLE' : 'LOCAL_OUTBOX' }));
router.post('/verify-email', validate(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) })), asyncHandler(async (req, res) => {
  const hash = crypto.createHash('sha256').update(req.body.token).digest('hex');
  const verified = await prisma.user.updateMany({ where: { emailVerificationTokenHash: hash, emailVerificationExpiresAt: { gt: new Date() } }, data: { isVerified: true, emailVerifiedAt: new Date(), emailVerificationTokenHash: null, emailVerificationExpiresAt: null } });
  if (!verified.count) return res.status(400).json({ message: 'Link xác nhận đã sử dụng hoặc hết hạn' });
  res.json({ message: 'Đã xác nhận email thành công' });
}));
router.post('/resend-verification', mailLimit(10), validate(forgotSchema), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (user && !user.emailVerifiedAt) {
    const token = crypto.randomBytes(32).toString('hex');
    const v = makeOtp();
    await prisma.user.update({ where: { id: user.id }, data: { emailVerificationTokenHash: crypto.createHash('sha256').update(token).digest('hex'), emailVerificationExpiresAt: new Date(Date.now() + 86400_000), emailOtpHash: v.hash, emailOtpExpiresAt: v.expiresAt, emailOtpAttempts: 0 } });
    await sendAccountEmail(user.email, 'verify', token, v.otp);
  }
  res.json({ message: 'Nếu tài khoản chưa xác nhận, thư xác nhận đã được tạo.' });
}));
// POST /api/v1/auth/verify-otp — xác nhận email bằng OTP 6 số
router.post('/verify-otp', mailLimit(30), validate(z.object({ email: emailField, otp: z.string().regex(/^\d{6}$/, 'OTP gồm 6 chữ số') })), asyncHandler(async (req, res) => {
  const r = await consumeOtp('verify', req.body.email, req.body.otp);
  if (!r.ok) return res.status(400).json({ message: r.error });
  await prisma.user.update({ where: { id: r.user.id }, data: { isVerified: true, emailVerifiedAt: new Date(), emailVerificationTokenHash: null, emailVerificationExpiresAt: null } });
  res.json({ message: 'Đã xác nhận email thành công' });
}));
// POST /api/v1/auth/reset-password-otp — đặt lại mật khẩu bằng OTP 6 số
router.post('/reset-password-otp', mailLimit(30), validate(z.object({ email: emailField, otp: z.string().regex(/^\d{6}$/, 'OTP gồm 6 chữ số'), newPassword: passwordField(6, 'Mật khẩu mới') })), asyncHandler(async (req, res) => {
  const r = await consumeOtp('reset', req.body.email, req.body.otp);
  if (!r.ok) return res.status(400).json({ message: r.error });
  await prisma.user.update({ where: { id: r.user.id }, data: { passwordHash: await bcrypt.hash(req.body.newPassword, 10), passwordResetTokenHash: null, passwordResetExpiresAt: null, sessionVersion: { increment: 1 } } });
  res.json({ message: 'Đặt lại mật khẩu thành công' });
}));
module.exports = router;

router.post('/logout', auth, asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { sessionVersion: { increment: 1 } } });
  res.json({ message: 'Đã đăng xuất và thu hồi các phiên đăng nhập.' });
}));
router.post('/change-password', auth, validate(z.object({ currentPassword: z.string().min(1).max(72), newPassword: passwordField(8, 'Mật khẩu mới') })), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!await bcrypt.compare(req.body.currentPassword, user.passwordHash)) return res.status(400).json({ message: 'Mật khẩu hiện tại chưa đúng' });
  const passwordHash = await bcrypt.hash(req.body.newPassword, 10);
  const moved = await prisma.user.updateMany({ where: { id: user.id, passwordHash: user.passwordHash }, data: { passwordHash, sessionVersion: { increment: 1 }, passwordResetTokenHash: null, passwordResetExpiresAt: null } });
  if (!moved.count) return res.status(409).json({ message: 'Tài khoản vừa thay đổi, hãy đăng nhập lại' });
  res.json({ message: 'Đã đổi mật khẩu và thu hồi các phiên. Hãy đăng nhập lại.' });
}));
