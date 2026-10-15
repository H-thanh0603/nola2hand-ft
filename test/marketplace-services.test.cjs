const test = require('node:test');
const assert = require('node:assert/strict');
const { listingWhere, validateSpecifications } = require('../src/services/catalog');
const { dateRange, dailyRevenue } = require('../src/services/revenue');
const { localSearch } = require('../src/services/assistant-search');
const { jsonAnswer, localSentiment, analyzeSentiment } = require('../src/services/ai');
const { sendAccountEmail } = require('../src/services/mail');
const { decodeImage } = require('../src/routes/upload');
const { expireReservations } = require('../src/services/reservations');
const { notifyMatchingSearches } = require('../src/services/saved-searches');

test('catalog accepts zero prices and validates category specifications', () => {
  const where = listingWhere({ maxPrice: '0', verified: 'true', deliveryMethod: 'MEETUP' });
  assert.equal(where.status, 'ACTIVE');
  assert.deepEqual(where.price, { lte: 0 });
  assert.deepEqual(where.deliveryMethod.in, ['MEETUP', 'ANY']);
  assert.deepEqual(where.seller, { status: 'ACTIVE', idVerified: true });
  assert.throws(() => listingWhere({ minPrice: 100, maxPrice: 0 }));
  assert.throws(() => validateSpecifications('dien-tu-cu', { batteryHealth: '101' }));
  assert.throws(() => validateSpecifications('noi-that', { batteryHealth: '90' }));
  validateSpecifications('noi-that', { width: '120.5', material: 'Gỗ' });
});
test('search fallback handles Vietnamese budget, location and long input', () => {
  assert.deepEqual(localSearch('laptop dưới 6,5 triệu tại Hà Nội'), { q: 'laptop', maxPrice: 6500000, city: 'Hà Nội' });
  assert.equal(localSearch('tai nghe dưới 500k').maxPrice, 500000);
  assert.equal(localSearch('a'.repeat(500)).q.length, 150);
});
test('revenue uses collected wallet income minus fees and fills empty days', async () => {
  assert.throws(() => dateRange({ from: '2026-02-30', to: '2026-03-01' }));
  assert.throws(() => dateRange({ from: '2026-10-02', to: '2026-10-01' }));
  const createdAt = new Date('2026-10-01T10:00:00Z');
  let walletQuery;
  const client = { walletTransaction: { findMany: async q => { walletQuery = q; return [{ createdAt, amount: 100000 }, { createdAt, amount: -25000 }]; } }, order: { findMany: async () => [{ createdAt }] } };
  const result = await dailyRevenue(client, { from: '2026-10-01', to: '2026-10-02' }, 2);
  assert.equal(walletQuery.where.wallet.userId, 2);
  assert.equal(walletQuery.where.status, 'SUCCESS');
  assert.deepEqual(result.data, [{ date: '2026-10-01', revenue: 75000, orders: 1 }, { date: '2026-10-02', revenue: 0, orders: 0 }]);
});
test('upload rejects text disguised as an image and oversized data', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jTzQAAAAASUVORK5CYII=', 'base64');
  assert.deepEqual(decodeImage(png.toString('base64'), 'image/png'), png);
  assert.throws(() => decodeImage(Buffer.from('<script>alert(1)</script>').toString('base64'), 'image/png'));
  assert.throws(() => decodeImage(png.toString('base64'), 'image/jpeg'));
  assert.throws(() => decodeImage(Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64'), 'image/png'));
});
test('reservation expiry does not reopen a listing when deposit won the race', async () => {
  let reopened = 0;
  const tx = { order: { updateMany: async () => ({ count: 0 }) }, listing: { updateMany: async () => { reopened++; } } };
  const client = { actionQuota: { deleteMany: async () => {} }, order: { findMany: async () => [{ id: 1, listingId: 2 }] }, $transaction: async fn => fn(tx) };
  assert.equal(await expireReservations(client), 0);
  assert.equal(reopened, 0);
  tx.order.updateMany = async () => ({ count: 1 });
  tx.orderTimeline = { create: async () => {} };
  tx.notification = { create: async () => {} };
  assert.equal(await expireReservations(client), 1);
  assert.equal(reopened, 1);
});
test('saved search sends one notification per listing and search', async () => {
  let matched = false, notifications = 0;
  const tx = { savedSearchMatch: { createMany: async () => { if (matched) return { count: 0 }; matched = true; return { count: 1 }; } }, notification: { create: async () => { notifications++; } } };
  const client = { savedSearch: { findMany: async () => [{ id: 1, userId: 3, name: 'Laptop', filters: { maxPrice: 6000000 } }] }, listing: { findFirst: async () => ({ id: 2, sellerId: 4, title: 'Laptop' }) }, $transaction: async fn => fn(tx) };
  assert.equal(await notifyMatchingSearches(2, client), 1);
  assert.equal(await notifyMatchingSearches(2, client), 0);
  assert.equal(notifications, 1);
});
test('sentiment preserves negative language and falls back when AI is unavailable', async () => {
  assert.equal(localSentiment('Hàng đẹp nhưng bị lỗi', 5).sentiment, 'NEGATIVE');
  assert.equal(localSentiment('', 3).sentiment, 'NEUTRAL');
  const prior = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try { assert.equal((await analyzeSentiment('rất hài lòng', 5)).sentimentSource, 'LOCAL'); }
  finally { if (prior !== undefined) process.env.OPENAI_API_KEY = prior; }
});

test('external email and AI requests use configured services with safe fallback', async () => {
  const keys = ['RESEND_API_KEY','MAIL_FROM','OPENAI_API_KEY','OPENAI_MODEL','AI_REVIEW_ANALYSIS'];
  const prior = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const previousFetch = global.fetch;
  try {
    Object.assign(process.env, { RESEND_API_KEY: 'test-only', MAIL_FROM: 'test@example.com', OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'test-model', AI_REVIEW_ANALYSIS: 'true' });
    let sent;
    global.fetch = async (url, options) => { sent = { url, ...options }; return { ok: true }; };
    assert.equal(await sendAccountEmail('buyer@example.com', 'verify', 'one-use-token'), 'EMAIL');
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.match(JSON.parse(sent.body).text, /#\/verify\/one-use-token/);
    assert.match(sent.headers['Idempotency-Key'], /^[a-f0-9]{64}$/);
    global.fetch = async (url, options) => { sent = { url, ...options }; return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: '{"sentiment":"POSITIVE"}' }] }] }) }; };
    assert.deepEqual(await jsonAnswer('Classify', { comment: 'đẹp' }), { sentiment: 'POSITIVE' });
    assert.equal(JSON.parse(sent.body).store, false);
    assert.equal(sent.url, 'https://api.openai.com/v1/responses');
    global.fetch = async () => ({ ok: false });
    assert.equal((await analyzeSentiment('bị lỗi', 1)).sentimentSource, 'LOCAL');
    await assert.rejects(sendAccountEmail('buyer@example.com', 'reset', 'token'), e => e.status === 503);
  } finally {
    global.fetch = previousFetch;
    for (const key of keys) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key]; }
  }
});
