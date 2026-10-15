async function lockUser(tx, id) {
  await tx.$queryRawUnsafe('SELECT id FROM "User" WHERE id = $1 FOR UPDATE', id);
}
async function lockOrder(tx, id) {
  await tx.$queryRawUnsafe('SELECT id FROM "Order" WHERE id = $1 FOR UPDATE', id);
}
module.exports = { lockUser, lockOrder };
