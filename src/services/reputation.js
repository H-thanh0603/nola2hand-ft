function responseStats(messages) {
  const waiting = new Map(), durations = [];
  let turns = 0, responses = 0;
  for (const m of messages) {
    const key = `${m.otherId}:${m.listingId || 0}`;
    if (m.incoming) {
      if (!waiting.has(key)) { waiting.set(key, new Date(m.createdAt).getTime()); turns++; }
    } else if (waiting.has(key)) {
      durations.push(Math.max(0, new Date(m.createdAt).getTime() - waiting.get(key)) / 1000);
      responses++; waiting.delete(key);
    }
  }
  durations.sort((a,b)=>a-b);
  const median = durations.length ? (durations[Math.floor((durations.length-1)/2)] + durations[Math.floor(durations.length/2)]) / 2 : null;
  return { inquiries: turns, responses, responseRate: turns ? Math.round(responses / turns * 100) : null, medianResponseSeconds: median };
}
async function shopReputation(client, user) {
  const [orders, messages, reviews, returned] = await Promise.all([
    client.order.groupBy({by:['status'],where:{sellerId:user.id},_count:{status:true}}),
    client.message.findMany({where:{OR:[{senderId:user.id},{receiverId:user.id}],createdAt:{gte:new Date(Date.now()-90*86400000)}},select:{senderId:true,receiverId:true,listingId:true,createdAt:true},orderBy:{createdAt:'desc'},take:10000}),
    client.review.aggregate({where:{revieweeId:user.id},_avg:{rating:true},_count:true}),
    client.returnRequest.count({where:{order:{sellerId:user.id},status:'REFUNDED'}}),
  ]);
  const count = status => orders.find(o=>o.status===status)?._count.status || 0;
  const totalOrders = orders.reduce((sum,o)=>sum+o._count.status,0), cancelledOrders=count('CANCELLED');
  const replies=responseStats(messages.reverse().map(m=>({...m,incoming:m.receiverId===user.id,otherId:m.senderId===user.id?m.receiverId:m.senderId})));
  return { totalOrders,completedOrders:count('COMPLETED'),cancelledOrders,refundedOrders:count('REFUNDED'),returnedOrders:returned,cancellationRate:totalOrders?Math.round(cancelledOrders/totalOrders*1000)/10:null,rating:reviews._avg.rating || 0,totalReviews:reviews._count,...replies,emailVerified:Boolean(user.emailVerifiedAt),identityVerified:user.idVerified===true,responseWindowDays:90,messageSample:messages.length };
}
module.exports={responseStats,shopReputation};
