const express = require('express');
const prisma = require('../prisma');
const { auth, requireRole, asyncHandler } = require('../middleware');
const { paginate, pagedResult } = require('../utils');
const { dateRange } = require('../services/revenue');
const router = express.Router();
router.use(auth, requireRole('ADMIN_CONTENT', 'ADMIN_FINANCE'));
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = req.query.q ? { OR: [{ action: { contains: req.query.q, mode: 'insensitive' } }, { target: { contains: req.query.q, mode: 'insensitive' } }] } : {};
  if (req.query.from || req.query.to) { const { from, to } = dateRange(req.query); where.createdAt = { gte: from, lte: to }; }
  const [data, total] = await Promise.all([prisma.auditLog.findMany({ where, include: { admin: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: limit, skip }), prisma.auditLog.count({ where })]);
  res.json(pagedResult(data, total, page, limit));
}));
module.exports = router;
