const prisma = require('../prisma');
const { pushTimeline, notify } = require('../utils');

async function expireReservations(client = prisma, now = new Date()) {
  const orders = await client.order.findMany({
    where: { status: 'PENDING_DEPOSIT', reservationExpiresAt: { lte: now } },
    take: 100, orderBy: { reservationExpiresAt: 'asc' },
  });
  let expired = 0;
  await client.actionQuota.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 2 * 86400000) } } });
  for (const order of orders) {
    await client.$transaction(async tx => {
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING_DEPOSIT', reservationExpiresAt: { lte: now } },
        data: { status: 'CANCELLED', cancelReason: 'Hết thời hạn đặt cọc' },
      });
      if (!moved.count) return;
      await tx.listing.updateMany({ where: { id: order.listingId, status: 'RESERVED' }, data: { status: 'ACTIVE' } });
      await pushTimeline(tx, order.id, 'CANCELLED', 'Tự hủy sau khi hết 30 phút chờ đặt cọc');
      await notify(tx, order.buyerId, 'ORDER', 'Đơn hết thời hạn giữ món', order.code, { orderId: order.id });
      expired++;
    });
  }
  return expired;
}
module.exports = { expireReservations };
