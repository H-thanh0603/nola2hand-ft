const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const schema = new Proxy(() => schema, { get: () => schema, apply: () => schema });
const noop = () => {};

function loadModule(file, { prisma = {}, utils = {}, jwt } = {}) {
  const routes = [];
  const router = { use: noop };
  for (const method of ['get', 'post', 'patch', 'delete']) router[method] = (route, ...handlers) => routes.push({ method, route, handler: handlers.at(-1) });
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInNewContext(source, {
    module,
    console,
    process: { env: { JWT_SECRET: 'test-secret' } },
    require(name) {
      if (name === 'express') return { Router: () => router };
      if (name === 'zod') return { z: schema };
      if (name === '../prisma' || name === './prisma') return prisma;
      if (name === '../utils') return utils;
      if (name === '../middleware') return { asyncHandler: (fn) => fn, auth: noop, requireRole: () => noop, validate: () => noop };
      if (name === 'jsonwebtoken') return jwt;
      if (name === '../services/reservations') return { expireReservations: async () => {} };
      if (name === 'crypto') return require('node:crypto');
      if (name === 'bcryptjs') return { hash: async () => 'hashed-password' };
      if (name === 'google-auth-library') return { OAuth2Client: class {} };
      if (name === '../services/mail') return { sendAccountEmail: async () => 'LOCAL_OUTBOX' };
      if (name === '../validators') return { emailField: schema, phoneVN: schema, passwordField: () => schema, httpUrl: () => schema, text: () => schema };
      if (name === 'express-rate-limit') return () => noop;
      if (name === '../services/catalog') return require('../src/services/catalog');
      if (name === '../services/guards') return { accountLimit: () => noop, verifiedAccount: noop };
      if (name === '../services/locks') return { lockUser: async () => {}, lockOrder: async () => {} };
      if (name === '../services/admin-permissions') return require('../src/services/admin-permissions');
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { exported: module.exports, routes };
}

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
}

function routeHandler(module, method, route) {
  return module.routes.find((entry) => entry.method === method && entry.route === route).handler;
}

test('email verification token is hashed and can be consumed once', async () => {
  const token = 'a'.repeat(64);
  let stored = require('node:crypto').createHash('sha256').update(token).digest('hex');
  let verified = false;
  const module = loadModule('src/routes/auth.js', { prisma: { user: { updateMany: async ({ where, data }) => { if (!stored || stored !== where.emailVerificationTokenHash) return { count: 0 }; stored = data.emailVerificationTokenHash; verified = data.isVerified; return { count: 1 }; } } } });
  const handler = routeHandler(module, 'post', '/verify-email');
  const req = { body: { token } };
  const first = response(); await handler(req, first);
  assert.equal(first.statusCode, 200); assert.equal(verified, true); assert.equal(stored, null);
  const second = response(); await handler(req, second);
  assert.equal(second.statusCode, 400);
});
test('profile response does not expose reset or verification credentials', async () => {
  const user = { id: 1, fullName: 'Buyer', roles: [], passwordHash: 'secret', passwordResetTokenHash: 'reset', passwordResetExpiresAt: new Date(), emailVerificationTokenHash: 'verify', emailVerificationExpiresAt: new Date() };
  const module = loadModule('src/routes/users.js', { prisma: { user: { findUnique: async () => user } } });
  const res = response(); await routeHandler(module, 'get', '/me/profile')({ user: { id: 1 } }, res);
  assert.equal(res.body.fullName, 'Buyer');
  for (const field of ['passwordHash','passwordResetTokenHash','passwordResetExpiresAt','emailVerificationTokenHash','emailVerificationExpiresAt']) assert.equal(Object.hasOwn(res.body, field), false);
});
test('a revoked access token is rejected after password change', async () => {
  const module = loadModule('src/middleware.js', { jwt: { verify: () => ({ sub: 1, purpose:'access', sessionVersion:0 }) }, prisma:{user:{findUnique:async()=>({id:1,status:'ACTIVE',sessionVersion:1,roles:[]})}} });
  let passed=false;const res=response();await module.exported.auth({headers:{authorization:'Bearer old'}},res,()=>{passed=true;});assert.equal(passed,false);assert.equal(res.statusCode,401);
});
test('content admin and self-role edits are rejected before a transaction', async () => {
  const module=loadModule('src/routes/admin-users.js',{prisma:{$transaction:async()=>{throw Error('Must not mutate');}}});
  const handler=routeHandler(module,'patch','/:id/roles');
  for(const user of [{id:1,roles:['ADMIN_CONTENT'],canManageRoles:false},{id:1,roles:['ADMIN_FINANCE'],canManageRoles:true}]){
    const res=response();await handler({params:{id:1},user,body:{roles:['ADMIN_FINANCE']}},res);assert.equal(res.statusCode,403);
  }
});
test('refund rereads money after a concurrent remainder payment', async () => {
  let amount=20000,refunded=0;
  const escrow={id:1,orderId:1,status:'HELD',amount,order:{buyerId:1,sellerId:2,listingId:3,status:'DEPOSITED',code:'O1'}};
  const tx={order:{updateMany:async()=>({count:1})},returnRequest:{findUnique:async()=>null},escrow:{findUnique:async()=>({...escrow,amount}),updateMany:async()=>({count:1})},listing:{updateMany:async()=>({count:1})}};
  const module=loadModule('src/routes/escrow.js',{prisma:{escrow:{findUnique:async()=>escrow},$transaction:async fn=>{amount+=80000;return fn(tx);}},utils:{applyWallet:async(_tx,_user,_type,money)=>{refunded+=money;},pushTimeline:async()=>{},notify:async()=>{}}});
  await routeHandler(module,'post','/:id/refund')({params:{id:1},user:{id:2,roles:['SELLER']},body:{reason:'Hoàn đơn'}},response());assert.equal(refunded,100000);
});
test('pending order cap stops reservation at three open orders', async () => {
  const tx={order:{count:async()=>3},listing:{updateMany:async()=>{throw Error('Must not reserve fourth item');}}};
  const module=loadModule('src/routes/orders.js',{prisma:{listing:{findUnique:async()=>({id:1,status:'ACTIVE',sellerId:2,price:100000,categoryId:1})},$transaction:async fn=>fn(tx)},utils:{calcPlatformFee:async()=>({fee:5000})}});
  await assert.rejects(module.exported.createSingleOrder({buyerId:1,listingId:1,ship:{}}),e=>e.status===429);
});
test('COD acknowledgement requires seller and never credits external cash to wallet', async () => {
  const order = { id: 1, sellerId: 2, buyerId: 3, status: 'DELIVERED', settlementMethod: 'COD', remainingAmount: 80000, code: 'O1' };
  let walletCalls = 0, moved = false;
  const tx = { order: { updateMany: async ({ data }) => { assert.equal(data.remainingAmount, 0); assert.ok(data.codCollectedAt); moved = true; return { count: 1 }; } } };
  const module = loadModule('src/routes/orders.js', { prisma: { order: { findUnique: async () => order }, $transaction: async fn => fn(tx) }, utils: { applyWallet: async () => walletCalls++, pushTimeline: async () => {}, notify: async () => {} } });
  const handler = routeHandler(module, 'post', '/:id/confirm-cod');
  const denied = response(); await handler({ params: { id: 1 }, user: { id: 3 } }, denied);
  assert.equal(denied.statusCode, 404); assert.equal(moved, false);
  await handler({ params: { id: 1 }, user: { id: 2 } }, response());
  assert.equal(moved, true); assert.equal(walletCalls, 0);
});
test('buyer cannot complete an order with an unpaid remainder', async () => {
  const order = { id: 1, buyerId: 2, sellerId: 3, status: 'DELIVERED', remainingAmount: 80000 };
  const module = loadModule('src/routes/orders.js', { prisma: { order: { findUnique: async () => order }, $transaction: async () => { throw new Error('Must not settle unpaid order'); } } });
  const res = response(); await routeHandler(module, 'patch', '/:id/status')({ params: { id: 1 }, user: { id: 2 }, body: { to: 'COMPLETED' } }, res);
  assert.equal(res.statusCode, 400);
});
test('reserved listings cannot be deleted by seller', async () => {
  let changed;
  const module = loadModule('src/routes/listings.js', { prisma: { listing: { findUnique: async () => ({ id: 1, sellerId: 2, status: 'RESERVED' }), updateMany: async ({ where }) => { changed = where; return { count: 0 }; } } } });
  const res = response(); await routeHandler(module, 'delete', '/:id')({ params: { id: 1 }, user: { id: 2 } }, res);
  assert.equal(res.statusCode, 409); assert.equal(changed.status.in.includes('RESERVED'), false);
});

test('expired deposit never debits a wallet', async () => {
  let debits = 0;
  const order = { id: 1, buyerId: 2, status: 'PENDING_DEPOSIT', totalAmount: 100000 };
  const tx = { order: { updateMany: async () => ({ count: 0 }) } };
  const module = loadModule('src/routes/escrow.js', { prisma: { order: { findUnique: async () => order }, $transaction: async fn => fn(tx) }, utils: { applyWallet: async () => debits++ } });
  await assert.rejects(routeHandler(module, 'post', '/orders/:id/deposit')({ params: { id: 1 }, user: { id: 2 }, body: { paymentMethod: 'SAFEPAY_WALLET' } }, response()), err => err.status === 409);
  assert.equal(debits, 0);
});
test('remainder payment concurrent requests debit only once', async () => {
  const order = { id: 1, buyerId: 2, status: 'DEPOSITED', remainingAmount: 80000, code: 'O1' };
  let remaining = 80000, debits = 0, held = 20000;
  const tx = { order: { updateMany: async ({ where }) => { if (remaining !== where.remainingAmount) return { count: 0 }; remaining = 0; return { count: 1 }; } }, escrow: { updateMany: async ({ data }) => { held += data.amount.increment; return { count: 1 }; } } };
  const module = loadModule('src/routes/escrow.js', { prisma: { order: { findUnique: async () => ({ ...order }) }, $transaction: async fn => fn(tx) }, utils: { applyWallet: async (_tx, _user, _type, amount) => { assert.equal(amount, -80000); debits++; }, pushTimeline: async () => {} } });
  const handler = routeHandler(module, 'post', '/orders/:id/pay-remainder');
  const results = await Promise.allSettled([handler({ params: { id: 1 }, user: { id: 2 } }, response()), handler({ params: { id: 1 }, user: { id: 2 } }, response())]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(debits, 1);
  assert.equal(held, 100000);
});
test('two dispute decisions cannot release held money twice', async () => {
  let status = 'DISPUTED', income = 0;
  const dispute = { id: 1, orderId: 2, buyerId: 3, sellerId: 4, status: 'OPEN', amount: 100000, code: 'D1', order: { id: 2, listingId: 5, sellerId: 4, platformFee: 25000, code: 'O1', escrow: { id: 1, status: 'HELD', amount: 100000 } } };
  const tx = { order: { updateMany: async () => ({ count: status === 'DISPUTED' ? 1 : 0 }), update: async ({ data }) => { status = data.status; } }, dispute: { updateMany: async () => ({ count: 1 }), update: async () => {} }, escrow: { updateMany: async () => ({ count: 1 }) }, listing: { update: async () => {} }, auditLog: { create: async () => {} } };
  const module = loadModule('src/routes/disputes.js', { prisma: { dispute: { findUnique: async () => dispute }, $transaction: async fn => fn(tx) }, utils: { applyWallet: async (_tx, _id, _type, amount) => { income += amount; }, pushTimeline: async () => {}, notify: async () => {} } });
  const handler = routeHandler(module, 'patch', '/admin/:id/resolve');
  const req = { params: { id: 1 }, user: { id: 6 }, body: { decision: 'SELLER_WINS', resolution: 'Có bằng chứng giao hàng' } };
  await handler(req, response());
  assert.equal(income, 75000);
  await assert.rejects(handler(req, response()), err => err.status === 409);
  assert.equal(income, 75000);
});

test('auth middleware rejects a password-reset token', async () => {
  const middleware = loadModule('src/middleware.js', {
    jwt: { verify: () => ({ sub: 1, purpose: 'reset' }) },
    prisma: { user: { findUnique: async () => ({ id: 1, status: 'ACTIVE', roles: [] }) } },
  }).exported;
  const res = response();
  let nextCalled = false;
  await middleware.auth({ headers: { authorization: 'Bearer reset-token' } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('wallet cannot spend the same balance twice', async () => {
  const { exported: { applyWallet } } = loadModule('src/utils.js');
  let balance = 100_000;
  const ledger = [];
  const tx = {
    wallet: {
      upsert: async () => ({ id: 1, balance }),
      updateMany: async ({ where, data }) => {
        if (where.balance && balance < where.balance.gte) return { count: 0 };
        balance += data.balance.increment;
        return { count: 1 };
      },
      findUnique: async () => ({ id: 1, balance }),
    },
    walletTransaction: { create: async ({ data }) => ledger.push(data) },
  };
  const results = await Promise.allSettled([
    applyWallet(tx, 1, 'WITHDRAW', -80_000, 'A', 'rút tiền'),
    applyWallet(tx, 1, 'WITHDRAW', -80_000, 'B', 'rút tiền'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(balance, 20_000);
  assert.equal(ledger.length, 1);
});

test('an active listing is reserved by the first order only', async () => {
  let status = 'ACTIVE';
  let ordersCreated = 0;
  const listing = { id: 3, sellerId: 2, price: 500_000, categoryId: 1, title: 'Bàn phím' };
  const tx = {
    listing: { updateMany: async ({ where, data }) => {
      if (where.status !== status) return { count: 0 };
      status = data.status;
      return { count: 1 };
    } },
    order: { count: async () => 0, create: async ({ data }) => ({ id: ++ordersCreated, ...data }) },
  };
  const orders = loadModule('src/routes/orders.js', {
    prisma: { listing: { findUnique: async () => ({ ...listing, status }) }, $transaction: async (fn) => fn(tx) },
    utils: { calcPlatformFee: async () => ({ fee: 25_000 }), genOrderCode: () => 'NL2H-TEST', notify: async () => {}, pushTimeline: async () => {} },
  }).exported;
  await orders.createSingleOrder({ buyerId: 1, listingId: 3, ship: {} });
  await assert.rejects(orders.createSingleOrder({ buyerId: 4, listingId: 3, ship: {} }), /Sản phẩm không khả dụng/);
  assert.equal(status, 'RESERVED');
  assert.equal(ordersCreated, 1);
});

test('completion releases only the held escrow amount', async () => {
  const order = { id: 1, code: 'NL2H-TEST', buyerId: 1, sellerId: 2, listingId: 3, status: 'DELIVERED', platformFee: 25_000 };
  const credits = [];
  let escrowStatus = 'HELD';
  let listingStatus = 'RESERVED';
  const tx = {
    order: {
      updateMany: async ({ data }) => { order.status = data.status; return { count: 1 }; },
      findUnique: async () => ({ ...order }),
    },
    escrow: {
      findUnique: async () => ({ id: 4, status: escrowStatus, amount: 100_000 }),
      updateMany: async ({ where, data }) => {
        if (where.status !== escrowStatus) return { count: 0 };
        escrowStatus = data.status;
        return { count: 1 };
      },
    },
    listing: { update: async ({ data }) => { listingStatus = data.status; } },
  };
  const orders = loadModule('src/routes/orders.js', {
    prisma: { order: { findUnique: async () => ({ ...order }) }, $transaction: async (fn) => fn(tx) },
    utils: { applyWallet: async (_tx, _userId, type, amount) => credits.push({ type, amount }), notify: async () => {}, pushTimeline: async () => {} },
  });
  const res = response();
  await routeHandler(orders, 'patch', '/:id/status')({ params: { id: '1' }, user: { id: 1 }, body: { to: 'COMPLETED' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(credits, [{ type: 'ORDER_INCOME', amount: 100_000 }, { type: 'PLATFORM_FEE', amount: -25_000 }]);
  assert.equal(credits.reduce((sum, entry) => sum + entry.amount, 0), 75_000);
  assert.equal(escrowStatus, 'RELEASED');
  assert.equal(listingStatus, 'SOLD_OUT');
});

test('cancelling a deposited order refunds escrow and restores the listing', async () => {
  const order = { id: 1, code: 'NL2H-TEST', buyerId: 1, sellerId: 2, listingId: 3, status: 'DEPOSITED' };
  const credits = [];
  let escrowStatus = 'HELD';
  let listingStatus = 'RESERVED';
  const tx = {
    order: {
      updateMany: async ({ data }) => { order.status = data.status; return { count: 1 }; },
      findUnique: async () => ({ ...order }),
    },
    escrow: {
      findUnique: async () => ({ id: 4, status: escrowStatus, amount: 100_000 }),
      updateMany: async ({ where, data }) => {
        if (where.status !== escrowStatus) return { count: 0 };
        escrowStatus = data.status;
        return { count: 1 };
      },
    },
    listing: { updateMany: async ({ data }) => { listingStatus = data.status; return { count: 1 }; } },
  };
  const orders = loadModule('src/routes/orders.js', {
    prisma: { order: { findUnique: async () => ({ ...order }) }, $transaction: async (fn) => fn(tx) },
    utils: { applyWallet: async (_tx, _userId, type, amount) => credits.push({ type, amount }), notify: async () => {}, pushTimeline: async () => {} },
  });
  const res = response();
  await routeHandler(orders, 'patch', '/:id/status')(
    { params: { id: '1' }, user: { id: 1 }, body: { to: 'CANCELLED', note: 'Đổi ý' } },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(credits, [{ type: 'REFUND', amount: 100_000 }]);
  assert.equal(escrowStatus, 'REFUNDED');
  assert.equal(listingStatus, 'ACTIVE');
});
