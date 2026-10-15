// Helpers dùng chung
const prisma = require('./prisma');

/** Phân trang chuẩn: trả về { data, meta } */
function paginate(query, defaults = { page: 1, limit: 20 }) {
  const page = Math.max(1, parseInt(query.page ?? defaults.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? defaults.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function pagedResult(data, total, page, limit) {
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/** Sinh mã đơn hàng: NL2H-88291 */
function genOrderCode() {
  return 'NL2H-' + Math.floor(10000 + Math.random() * 90000);
}

/** Sinh mã tranh chấp: TC-1042 */
function genDisputeCode() {
  return 'TC-' + Math.floor(1000 + Math.random() * 9000);
}

/** Tính phí sàn cho 1 đơn hàng (ưu tiên fee riêng của danh mục) */
async function calcPlatformFee(categoryId, orderAmount) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  let percent = 5; // mặc định 5%
  if (category?.feePct != null) {
    percent = category.feePct;
  } else {
    const cfg = await prisma.feeConfig.findFirst({
      where: { kind: 'PLATFORM_TXN', name: 'Phí sàn chung', isActive: true },
    });
    if (cfg?.percent != null) percent = cfg.percent;
  }
  const minFeeCfg = await prisma.feeConfig.findFirst({
    where: { kind: 'PLATFORM_TXN', name: 'Phí sàn chung', isActive: true },
  });
  const raw = Math.round((orderAmount * percent) / 100);
  const min = minFeeCfg?.minAmount ?? 5000;
  return { fee: Math.max(raw, min), percent };
}

/** Ghi timeline cho đơn hàng */
async function pushTimeline(tx, orderId, status, note) {
  const client = tx || prisma;
  await client.orderTimeline.create({ data: { orderId, status, note } });
}

/** Tạo thông báo cho user */
async function notify(tx, userId, type, title, body, data) {
  const client = tx || prisma;
  await client.notification.create({ data: { userId, type, title, body, data: data || {} } });
}

/** Cộng/trừ số dư ví trong transaction (amount âm = trừ) */
async function applyWallet(tx, userId, type, amount, reference, note) {
  let wallet = await tx.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  const updated = await tx.wallet.updateMany({
    where: {
      id: wallet.id,
      ...(amount < 0 ? { balance: { gte: -amount } } : {}),
    },
    data: { balance: { increment: amount } },
  });
  if (!updated.count) {
    const e = new Error('Số dư ví không đủ');
    e.status = 400;
    throw e;
  }
  wallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
  const balanceAfter = wallet.balance;
  await tx.walletTransaction.create({
    data: { walletId: wallet.id, type, amount, balanceAfter, reference, note },
  });
  return balanceAfter;
}

module.exports = {
  paginate,
  pagedResult,
  genOrderCode,
  genDisputeCode,
  calcPlatformFee,
  pushTimeline,
  notify,
  applyWallet,
};
