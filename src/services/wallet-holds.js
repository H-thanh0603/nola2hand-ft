async function holdWallet(tx, userId, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw Object.assign(new Error('Số tiền giữ không hợp lệ'), { status: 400 });
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw Object.assign(new Error('Không tìm thấy ví'), { status: 404 });
  const changed = await tx.wallet.updateMany({ where: { id: wallet.id, balance: { gte: amount } }, data: { balance: { decrement: amount }, pendingBalance: { increment: amount } } });
  if (!changed.count) throw Object.assign(new Error('Số dư khả dụng không đủ để giữ tiền'), { status: 400 });
  return tx.wallet.findUnique({ where: { id: wallet.id } });
}
async function finishHold(tx, userId, amount, refund = false) {
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw Object.assign(new Error('Không tìm thấy ví'), { status: 404 });
  const changed = await tx.wallet.updateMany({ where: { id: wallet.id, pendingBalance: { gte: amount } }, data: { pendingBalance: { decrement: amount }, ...(refund ? { balance: { increment: amount } } : {}) } });
  if (!changed.count) throw Object.assign(new Error('Tiền giữ không khớp, cần đối soát'), { status: 409 });
  return tx.wallet.findUnique({ where: { id: wallet.id } });
}
async function postHeldLedger(tx, wallet, entries, reference, note) {
  for (const entry of entries) if (entry.amount) await tx.walletTransaction.create({ data: { walletId: wallet.id, ...entry, balanceAfter: wallet.balance, status: 'SUCCESS', reference, note } });
}
module.exports = { holdWallet, finishHold, postHeldLedger };
