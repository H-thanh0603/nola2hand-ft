// Finance admin: tổng quan, giao dịch, phí, báo cáo doanh thu
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { asyncHandler, auth, requireRole, validate } = require('../middleware');
const { paginate, pagedResult } = require('../utils');

const router = express.Router();
router.use(auth, requireRole('ADMIN_FINANCE'));

// GET /api/v1/admin/finance/overview — 4 thẻ KPI + giao dịch/tranh chấp gần đây
router.get('/overview', asyncHandler(async (req, res) => {
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [revenueAgg, totalTxns, refundReqs, openDisputes, recentTxns, recentDisputes] = await Promise.all([
    prisma.walletTransaction.aggregate({
      where: { type: 'PLATFORM_FEE', amount: { lt: 0 }, createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.walletTransaction.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.dispute.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
    prisma.dispute.count({ where: { status: 'OPEN' } }),
    prisma.walletTransaction.findMany({
      include: {
        wallet: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' }, take: 5,
    }),
    prisma.dispute.findMany({
      include: {
        buyer: { select: { fullName: true } }, seller: { select: { fullName: true } },
        order: { select: { code: true } },
      },
      where: { status: { in: ['OPEN', 'REVIEWING'] } },
      orderBy: { createdAt: 'desc' }, take: 5,
    }),
  ]);

  res.json({
    kpis: {
      monthlyRevenue: Math.abs(revenueAgg._sum.amount || 0),
      totalTransactions: totalTxns,
      pendingRefunds: refundReqs,
      openDisputes,
    },
    recentTransactions: recentTxns,
    recentDisputes,
  });
}));

// GET /api/v1/admin/finance/transactions — danh sách giao dịch + bộ lọc
router.get('/transactions', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.type) where.type = req.query.type;
  if (req.query.q) {
    where.OR = [
      { reference: { contains: req.query.q, mode: 'insensitive' } },
      { note: { contains: req.query.q, mode: 'insensitive' } },
      { wallet: { user: { fullName: { contains: req.query.q, mode: 'insensitive' } } } },
    ];
  }
  if (req.query.from || req.query.to) {
    const { from, to } = require('../services/revenue').dateRange(req.query);
    where.createdAt = { gte: from, lte: to };
  }
  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      include: {
        wallet: { include: { user: { select: { id: true, fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.walletTransaction.count({ where }),
  ]);
  res.json(pagedResult(items, total, page, limit));
}));

// GET /api/v1/admin/finance/revenue?months=6 — báo cáo doanh thu
router.get('/revenue', asyncHandler(async (req, res) => {
  const months = Math.min(12, Math.max(1, parseInt(req.query.months || '6', 10)));
  const labels = [];
  const monthly = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - i);
    const next = new Date(d); next.setMonth(next.getMonth() + 1);
    const agg = await prisma.walletTransaction.aggregate({
      where: { type: 'PLATFORM_FEE', amount: { lt: 0 }, createdAt: { gte: d, lt: next } },
      _sum: { amount: true },
    });
    labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    monthly.push(Math.abs(agg._sum.amount || 0));
  }
  const byCategory = await prisma.order.groupBy({
    by: ['listingId'], _sum: { platformFee: true }, _count: true,
    where: { status: 'COMPLETED' },
  });
  // Gộp theo danh mục
  const catMap = {};
  for (const g of byCategory) {
    const listing = await prisma.listing.findUnique({
      where: { id: g.listingId }, select: { category: { select: { name: true } } },
    });
    const name = listing?.category?.name || 'Khác';
    catMap[name] = catMap[name] || { category: name, orders: 0, fee: 0 };
    catMap[name].orders += g._count;
    catMap[name].fee += g._sum.platformFee || 0;
  }
  const total = monthly.reduce((a, b) => a + b, 0);
  res.json({
    total, labels, monthly,
    byCategory: Object.values(catMap).sort((a, b) => b.fee - a.fee),
  });
}));

// ---- Quản lý phí dịch vụ ----
const feeSchema = z.object({
  kind: z.enum(['PLATFORM_TXN', 'WITHDRAW', 'PENALTY']),
  name: z.string().trim().min(1).max(150),
  percent: z.number().min(0).max(100).optional(),
  amount: z.number().int().min(0).optional(),
  minAmount: z.number().int().min(0).optional(),
  condition: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

router.get('/fees', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.kind) where.kind = req.query.kind;
  res.json(await prisma.feeConfig.findMany({ where, orderBy: [{ kind: 'asc' }, { id: 'asc' }] }));
}));

router.post('/fees', validate(feeSchema), asyncHandler(async (req, res) => {
  const fee = await prisma.feeConfig.create({ data: req.body });
  await prisma.auditLog.create({
    data: { adminId: req.user.id, action: 'CREATE_FEE', target: `fee:${fee.id}`, detail: req.body },
  });
  res.status(201).json(fee);
}));

router.patch('/fees/:id', validate(feeSchema.partial()), asyncHandler(async (req, res) => {
  const fee = await prisma.feeConfig.update({ where: { id: +req.params.id }, data: req.body });
  await prisma.auditLog.create({
    data: { adminId: req.user.id, action: 'UPDATE_FEE', target: `fee:${fee.id}`, detail: req.body },
  });
  res.json(fee);
}));

router.delete('/fees/:id', asyncHandler(async (req, res) => {
  await prisma.feeConfig.delete({ where: { id: +req.params.id } });
  await prisma.auditLog.create({
    data: { adminId: req.user.id, action: 'DELETE_FEE', target: `fee:${req.params.id}` },
  });
  res.json({ message: 'Đã xoá cấu hình phí' });
}));


// GET /api/v1/admin/finance/charts/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD — biểu đồ cột doanh thu theo ngày
router.get('/charts/revenue', asyncHandler(async (req, res) => {
  res.json(await require('../services/revenue').dailyRevenue(prisma, req.query));
}));

// GET /api/v1/admin/finance/charts/order-status — biểu đồ tròn trạng thái đơn hàng
router.get('/charts/order-status', asyncHandler(async (req, res) => {
  const rows = await prisma.order.groupBy({ by: ['status'], _count: { status: true } });
  res.json(rows.map((r) => ({ status: r.status, count: r._count.status })));
}));

module.exports = router;

router.get('/withdrawals', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = req.query.status ? { status: z.enum(['PENDING','APPROVED','PAID','REJECTED','FAILED','CANCELLED']).parse(req.query.status) } : {};
  if (req.query.q) where.OR = [{ reference:{contains:String(req.query.q),mode:'insensitive'} }, { user:{fullName:{contains:String(req.query.q),mode:'insensitive'}} }];
  const [data,total] = await Promise.all([prisma.withdrawalRequest.findMany({ where, include:{user:{select:{id:true,fullName:true}}}, orderBy:{createdAt:'desc'},skip,take:limit }),prisma.withdrawalRequest.count({where})]);
  res.json(pagedResult(data,total,page,limit));
}));
router.patch('/withdrawals/:id', validate(z.object({ action:z.enum(['APPROVE','PAY','REJECT','FAIL']), resolution:z.string().trim().min(3).max(1000), transferReference:z.string().trim().min(3).max(150).optional() })), asyncHandler(async (req,res)=>{
  const id=z.coerce.number().int().positive().parse(req.params.id);
  res.json(await require('../services/withdrawals').transitionWithdrawal(prisma,req.user,id,req.body));
}));
