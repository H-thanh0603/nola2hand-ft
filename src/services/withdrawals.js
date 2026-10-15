const crypto = require('node:crypto');
const { holdWallet, finishHold, postHeldLedger } = require('./wallet-holds');
const { lockUser } = require('./locks');
const { notify } = require('../utils');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
async function requestWithdrawal(client, userId, input) {
  return client.$transaction(async tx => {
    await lockUser(tx, userId);
    const existing = await tx.withdrawalRequest.findUnique({ where: { userId_requestKey: { userId, requestKey: input.requestKey } } });
    if (existing) {
      if (existing.amount !== input.amount || existing.bankAccountId !== input.bankAccountId) fail(409, 'Mã yêu cầu đã dùng với nội dung khác');
      return existing;
    }
    const bank = await tx.bankAccount.findFirst({ where: { id: input.bankAccountId, wallet: { userId } } });
    if (!bank) fail(404, 'Không tìm thấy tài khoản ngân hàng');
    const cfg = await tx.feeConfig.findFirst({ where: { kind: 'WITHDRAW', name: 'Phí rút tiền tiêu chuẩn', isActive: true } });
    const fee = cfg?.amount ?? 0;
    const total = input.amount + fee;
    if (!Number.isSafeInteger(total) || total > 2_000_000_000 || fee < 0) fail(400, 'Số tiền/phí không hợp lệ');
    await holdWallet(tx, userId, total);
    return tx.withdrawalRequest.create({ data: { userId, requestKey: input.requestKey, bankAccountId: input.bankAccountId, reference: `WD-${crypto.randomUUID()}`, amount: input.amount, fee, bankName: bank.bankName, accountNumber: bank.accountNumber, accountName: bank.accountName } });
  });
}
async function transitionWithdrawal(client, actor, id, input) {
  return client.$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT id FROM "WithdrawalRequest" WHERE id=$1 FOR UPDATE', id);
    const request = await tx.withdrawalRequest.findUnique({ where: { id } });
    if (!request) fail(404, 'Không tìm thấy yêu cầu rút');
    const admin = actor.roles.includes('ADMIN_FINANCE');
    const allowed = { APPROVE: ['PENDING'], PAY: ['APPROVED'], REJECT: ['PENDING','APPROVED'], FAIL: ['APPROVED'], CANCEL: ['PENDING'] };
    if (input.action === 'CANCEL') { if (request.userId !== actor.id) fail(403, 'Chỉ chủ yêu cầu được hủy'); }
    else if (!admin) fail(403, 'Chỉ admin tài chính xử lý yêu cầu rút');
    else if (request.userId === actor.id) fail(403, 'Không được duyệt/chuyển yêu cầu rút của chính mình');
    if (!allowed[input.action]?.includes(request.status)) fail(409, 'Yêu cầu đã thay đổi hoặc không thể thực hiện bước này');
    if (input.action === 'PAY' && !input.transferReference?.trim()) fail(400, 'Cần mã chứng từ chuyển khoản thực tế');
    const status = { APPROVE:'APPROVED', PAY:'PAID', REJECT:'REJECTED', FAIL:'FAILED', CANCEL:'CANCELLED' }[input.action];
    const total = request.amount + request.fee;
    if (status !== 'APPROVED') {
      const wallet = await finishHold(tx, request.userId, total, status !== 'PAID');
      if (status === 'PAID') await postHeldLedger(tx, wallet, [{ type:'WITHDRAW', amount:-request.amount }, { type:'PLATFORM_FEE', amount:-request.fee }], request.reference, `Rút về ${request.bankName}; chứng từ ${input.transferReference}`);
    }
    const updated = await tx.withdrawalRequest.update({ where: { id }, data: { status, resolution: input.resolution, handledBy: actor.id, ...(status === 'PAID' ? { transferReference: input.transferReference, paidAt: new Date() } : {}) } });
    if (admin) await tx.auditLog.create({ data: { adminId: actor.id, action: `WITHDRAW_${input.action}`, target: `withdrawal:${id}`, detail: { amount: request.amount, fee: request.fee, resolution: input.resolution, transferReference: input.transferReference || null } } });
    await notify(tx, request.userId, 'WALLET', 'Cập nhật yêu cầu rút tiền', `${request.reference}: ${status}`, { withdrawalId: id });
    return updated;
  });
}
module.exports = { requestWithdrawal, transitionWithdrawal };
