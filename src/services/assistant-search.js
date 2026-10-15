function localSearch(message) {
  const text = message.trim();
  const budget = text.match(/(?:dưới|tối đa|không quá)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|nghìn|ngàn|k|đ|vnd)?/i);
  const location = text.match(/\s+(?:tại|ở)\s+(.+)$/i);
  let q = text.replace(location?.[0] || /$^/, '').replace(budget?.[0] || /$^/, '').trim();
  q = q.replace(/^(?:tôi cần|tìm|mua|cho tôi)\s+/i, '');
  const filters = { q: q.slice(0, 150) };
  if (budget) {
    const unit = budget[2]?.toLowerCase();
    const price = Number(budget[1].replace(',', '.')) * (['triệu','tr'].includes(unit) ? 1_000_000 : ['nghìn','ngàn','k'].includes(unit) ? 1000 : 1);
    if (Number.isFinite(price) && price <= 2_000_000_000) filters.maxPrice = Math.floor(price);
  }
  if (location) filters.city = location[1].trim().slice(0, 100);
  return filters;
}
module.exports = { localSearch };
