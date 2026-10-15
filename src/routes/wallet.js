// Wallet: ví SafePay — số dư, nạp, rút, lịch sử, tài khoản ngân hàng
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, validate } = require('../middleware');
const { paginate, pagedResult, applyWallet } = require('../utils');

const router = express.Router();

// GET /api/v1/wallet — số dư của tôi
router.get('/', auth, asyncHandler(async (req, res) => {
  let wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet) wallet = await prisma.wallet.create({ data: { userId: req.user.id } });
  res.json(wallet);
}));

// GET /api/v1/wallet/transactions?type=&from=&to=
router.get('/transactions', auth, asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet) return res.json(pagedResult([], 0, page, limit));
  const where = { walletId: wallet.id };
  if (req.query.type) where.type = req.query.type;
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt.gte = new Date(req.query.from);
    if (req.query.to) where.createdAt.lte = new Date(req.query.to);
  }
  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.walletTransaction.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

// POST /api/v1/wallet/topup — nạp tiền (demo: cộng ngay, thực tế qua cổng thanh toán)
router.post(
  '/topup',
  auth,
  validate(z.object({ amount: z.number().int().min(10000, 'Nạp tối thiểu 10.000đ'), method: z.string().default('MOMO_QR') })),
  asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production')
      return res.status(503).json({ message: 'Nạp tiền cần cổng thanh toán đã xác minh' });
    const balance = await prisma.$transaction((tx) =>
      applyWallet(tx, req.user.id, 'TOPUP', req.body.amount, 'TOPUP', `Nạp tiền qua ${req.body.method}`)
    );
    res.json({ message: `Nạp ${req.body.amount.toLocaleString('vi-VN')}đ thành công`, balance });
  })
);

// Withdrawal requests reserve funds until finance admin confirms transfer.
router.post('/withdraw', auth, require('../services/guards').accountLimit('WITHDRAW', 10, 86400000), validate(z.object({ amount: z.number().int().min(50000).max(1_000_000_000), bankAccountId: z.number().int().positive(), requestKey: z.string().uuid() })), asyncHandler(async (req, res) => {
  const request = await require('../services/withdrawals').requestWithdrawal(prisma, req.user.id, req.body);
  res.status(201).json({ message: 'Đã giữ tiền cho yêu cầu rút; chờ admin duyệt và chuyển khoản.', request, balance: (await prisma.wallet.findUnique({ where: { userId: req.user.id } })).balance });
}));
router.get('/withdrawals', auth, asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query), where = { userId: req.user.id };
  const [data, total] = await Promise.all([prisma.withdrawalRequest.findMany({ where, orderBy: { createdAt:'desc' }, skip, take:limit }), prisma.withdrawalRequest.count({ where })]);
  res.json(pagedResult(data,total,page,limit));
}));
router.patch('/withdrawals/:id/cancel', auth, asyncHandler(async (req, res) => {
  const id=z.coerce.number().int().positive().parse(req.params.id);
  const result = await require('../services/withdrawals').transitionWithdrawal(prisma, req.user, id, { action:'CANCEL', resolution:'Chủ yêu cầu hủy' });
  res.json(result);
}));

// ---- Tài khoản ngân hàng liên kết ----
router.get('/banks', auth, asyncHandler(async (req, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet) return res.json([]);
  res.json(await prisma.bankAccount.findMany({ where: { walletId: wallet.id }, orderBy: { isDefault: 'desc' } }));
}));

router.post(
  '/banks',
  auth,
  validate(z.object({
    bankName: z.string().trim().min(1).max(100), accountNumber: z.string().trim().min(6).max(30),
    accountName: z.string().trim().min(1).max(100), isDefault: z.boolean().optional(),
  })),
  asyncHandler(async (req, res) => {
    let wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) wallet = await prisma.wallet.create({ data: { userId: req.user.id } });
    if (req.body.isDefault)
      await prisma.bankAccount.updateMany({ where: { walletId: wallet.id }, data: { isDefault: false } });
    res.status(201).json(await prisma.bankAccount.create({ data: { ...req.body, walletId: wallet.id } }));
  })
);

router.delete('/banks/:id', auth, asyncHandler(async (req, res) => {
  const bank = await prisma.bankAccount.findFirst({
    where: { id: +req.params.id, wallet: { userId: req.user.id } },
  });
  if (!bank) return res.status(404).json({ message: 'Không tìm thấy' });
  await prisma.bankAccount.delete({ where: { id: bank.id } });
  res.json({ message: 'Đã xoá tài khoản ngân hàng' });
}));

module.exports = router;
