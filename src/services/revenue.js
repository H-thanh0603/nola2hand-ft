function dateRange(query, now = new Date()) {
  const parse = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Object.assign(new Error('Ngày phải có định dạng YYYY-MM-DD'), { status: 400 });
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw Object.assign(new Error('Ngày không hợp lệ'), { status: 400 });
    return date;
  };
  const from = parse(query.from || new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10));
  const to = parse(query.to || now.toISOString().slice(0, 10));
  if (to < from || to - from > 365 * 86400_000) throw Object.assign(new Error('Khoảng ngày tối đa 366 ngày và ngày đến phải sau ngày từ'), { status: 400 });
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}
async function dailyRevenue(client, query, sellerId) {
  const { from, to } = dateRange(query);
  const transactions = await client.walletTransaction.findMany({ where: { status: 'SUCCESS', createdAt: { gte: from, lte: to }, ...(sellerId ? { wallet: { userId: sellerId }, type: { in: ['ORDER_INCOME', 'PLATFORM_FEE'] } } : { type: 'PLATFORM_FEE', amount: { lt: 0 } }) }, select: { createdAt: true, amount: true } });
  const orders = await client.order.findMany({ where: { createdAt: { gte: from, lte: to }, ...(sellerId ? { sellerId } : {}) }, select: { createdAt: true } });
  const days = {};
  for (const t of transactions) { const key = t.createdAt.toISOString().slice(0, 10); days[key] ||= { revenue: 0, orders: 0 }; days[key].revenue += sellerId ? t.amount : -t.amount; }
  for (const o of orders) { const key = o.createdAt.toISOString().slice(0, 10); days[key] ||= { revenue: 0, orders: 0 }; days[key].orders++; }
  const data = [];
  for (let day = new Date(from); day <= to; day.setUTCDate(day.getUTCDate() + 1)) { const date = day.toISOString().slice(0, 10); data.push({ date, revenue: days[date]?.revenue || 0, orders: days[date]?.orders || 0 }); }
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), basis: sellerId ? 'NET_WALLET_INCOME' : 'COLLECTED_PLATFORM_FEES', timezone: 'UTC', data };
}
module.exports = { dateRange, dailyRevenue };
