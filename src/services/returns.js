const crypto = require('node:crypto');
const { lockOrder } = require('./locks');
const { holdWallet, finishHold, postHeldLedger } = require('./wallet-holds');
const { applyWallet, pushTimeline, notify } = require('../utils');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
function neutralAdmin(actor, order) { return actor.roles.includes('ADMIN_FINANCE') && ![order.buyerId, order.sellerId].includes(actor.id); }
function checkReturnWindow(order, now = new Date()) {
  const delivered = order.timeline.find(t => t.status === 'DELIVERED')?.createdAt;
  const completed = order.timeline.find(t => t.status === 'COMPLETED')?.createdAt;
  const at = delivered || completed;
  if (!at || now - new Date(at) > 7 * 86400000) fail(400, 'Hết thời hạn 7 ngày yêu cầu trả hàng');
}
async function requestReturn(client, buyerId, orderId, input) {
  return client.$transaction(async tx => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { escrow:true,returnRequest:true,dispute:true,timeline:{orderBy:{createdAt:'asc'}} } });
    if (!order || order.buyerId !== buyerId) fail(404, 'Không tìm thấy đơn mua');
    if (order.returnRequest) fail(409, 'Đơn đã có yêu cầu trả hàng');
    if (!['DELIVERED','COMPLETED'].includes(order.status) || order.dispute) fail(409, 'Đơn không đủ điều kiện trả hàng hoặc đã có tranh chấp');
    checkReturnWindow(order);
    if (!order.escrow || !['HELD','RELEASED'].includes(order.escrow.status)) fail(409, 'Không có khoản thanh toán khả dụng để hoàn');
    const refundAmount = order.escrow.amount;
    const codAmount = order.codCollectedAt ? Math.max(0, order.totalAmount - refundAmount) : 0;
    const request = await tx.returnRequest.create({ data: { orderId, reference:`RET-${crypto.randomUUID()}`, originalOrderStatus:order.status, reason:input.reason, evidences:input.evidences || [], refundAmount, codAmount } });
    await tx.order.update({ where:{id:orderId},data:{status:'DISPUTED'} });
    await pushTimeline(tx, orderId, 'RETURN_REQUESTED', input.reason);
    await notify(tx, order.sellerId, 'RETURN', 'Có yêu cầu trả hàng', order.code, { orderId, returnId:request.id });
    return request;
  });
}
async function transitionReturn(client, actor, id, input) {
  // Every money path locks order before escrow/wallet, matching checkout/refund.
  const pointer = await client.returnRequest.findUnique({ where:{id},select:{orderId:true} });
  if (!pointer) fail(404, 'Không tìm thấy yêu cầu trả hàng');
  return client.$transaction(async tx => {
    await lockOrder(tx, pointer.orderId);
    const request = await tx.returnRequest.findUnique({ where:{id},include:{order:{include:{escrow:true}}} });
    if (!request) fail(404, 'Không tìm thấy yêu cầu trả hàng');
    const order = request.order, admin = neutralAdmin(actor, order), seller = actor.id === order.sellerId, buyer = actor.id === order.buyerId;
    const action = input.action;
    const stages = { APPROVE:'REQUESTED', REJECT:'REQUESTED', CANCEL:'REQUESTED', SHIP:'APPROVED', RECEIVE:'SHIPPED', REFUND:'RECEIVED', COD_REFUND:'RECEIVED', COD_CONFIRM:'RECEIVED' };
    const permitted = ['APPROVE','REJECT','RECEIVE'].includes(action) ? seller || admin : ['CANCEL','SHIP','COD_CONFIRM'].includes(action) ? buyer : action === 'COD_REFUND' ? seller : action === 'REFUND' ? admin : false;
    if (!permitted) fail(403, 'Không có quyền thực hiện bước trả hàng này');
    if (request.status !== stages[action] || order.status !== 'DISPUTED') fail(409, 'Tiến trình đã thay đổi hoặc không thể bỏ qua bước');
    const data = { resolution:input.note || request.resolution };
    if (action === 'APPROVE') {
      const escrow = order.escrow;
      if (!escrow || !['HELD','RELEASED'].includes(escrow.status) || escrow.amount !== request.refundAmount) fail(409, 'Khoản hoàn đã thay đổi, cần đối soát');
      if (escrow.status === 'RELEASED') await holdWallet(tx, order.sellerId, request.refundAmount);
      Object.assign(data,{status:'APPROVED',approvedAt:new Date(),fundingSource:escrow.status === 'HELD' ? 'ESCROW' : 'SELLER_WALLET'});
    } else if (['REJECT','CANCEL'].includes(action)) {
      data.status = action === 'REJECT' ? 'REJECTED' : 'CANCELLED';
      await tx.order.update({where:{id:order.id},data:{status:request.originalOrderStatus}});
    } else if (action === 'SHIP') {
      if (!input.trackingCode?.trim()) fail(400, 'Cần mã vận đơn hoặc thông tin bàn giao');
      Object.assign(data,{status:'SHIPPED',shippedAt:new Date(),trackingCode:input.trackingCode});
    } else if (action === 'RECEIVE') {
      if (!input.note?.trim()) fail(400, 'Cần ghi nhận tình trạng hàng đã nhận lại');
      Object.assign(data,{status:'RECEIVED',receivedAt:new Date(),receivedNote:input.note});
    } else if (action === 'COD_REFUND') {
      if (!request.codAmount || request.codRefundedAt || !input.codReference?.trim()) fail(409, 'Cần khoản COD và chứng từ hoàn thực tế chưa ghi nhận');
      Object.assign(data,{codReference:input.codReference,codRefundedAt:new Date()});
    } else if (action === 'COD_CONFIRM') {
      if (!request.codRefundedAt || request.codConfirmedAt) fail(409, 'Người bán chưa ghi nhận hoàn COD hoặc đã xác nhận');
      data.codConfirmedAt = new Date();
    } else if (action === 'REFUND') {
      if (request.codAmount > 0 && !request.codConfirmedAt) fail(409, 'Cần người mua xác nhận đã nhận lại COD ngoài ví');
      if (request.fundingSource === 'ESCROW') {
        const claimed = await tx.escrow.updateMany({where:{orderId:order.id,status:'HELD',amount:request.refundAmount},data:{status:'REFUNDED',releasedAt:new Date()}});
        if (!claimed.count) fail(409, 'Khoản ký quỹ đã thay đổi');
      } else if (request.fundingSource === 'SELLER_WALLET') {
        const wallet = await finishHold(tx,order.sellerId,request.refundAmount);
        await postHeldLedger(tx,wallet,[{type:'ORDER_INCOME',amount:-request.refundAmount}],request.reference,`Hoàn tiền trả hàng ${order.code}`);
      } else fail(409, 'Chưa giữ đủ tiền cho yêu cầu hoàn');
      await applyWallet(tx,order.buyerId,'REFUND',request.refundAmount,request.reference,`Hoàn trả hàng ${order.code}`);
      await tx.order.update({where:{id:order.id},data:{status:'REFUNDED',remainingAmount:0}});
      await tx.listing.updateMany({where:{id:order.listingId,status:{in:['RESERVED','SOLD_OUT']}},data:{status:'HIDDEN'}});
      Object.assign(data,{status:'REFUNDED',refundedAt:new Date()});
    }
    const updated = await tx.returnRequest.update({where:{id},data});
    await pushTimeline(tx,order.id,`RETURN_${action}`,input.note || input.trackingCode || input.codReference || action);
    if (admin) await tx.auditLog.create({data:{adminId:actor.id,action:`RETURN_${action}`,target:`return:${id}`,detail:{refundAmount:request.refundAmount,codAmount:request.codAmount,note:input.note || ''}}});
    await notify(tx,buyer ? order.sellerId : order.buyerId,'RETURN','Tiến trình trả hàng cập nhật',`${order.code}: ${updated.status}`,{orderId:order.id,returnId:id});
    return updated;
  });
}
module.exports = { requestReturn, transitionReturn, checkReturnWindow };
