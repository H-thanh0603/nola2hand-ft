const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {requestWithdrawal,transitionWithdrawal}=require('../src/services/withdrawals');
const {requestReturn,transitionReturn,checkReturnWindow}=require('../src/services/returns');
const {assertRoleManager}=require('../src/services/admin-permissions');
const {responseStats}=require('../src/services/reputation');
const {evidenceName,mayReadEvidence}=require('../src/services/evidence');

function database(){
  let state={wallets:[{id:1,userId:1,balance:300000,pendingBalance:0},{id:2,userId:2,balance:200000,pendingBalance:0}],withdrawals:[],returns:[],ledger:[],order:{id:1,buyerId:1,sellerId:2,listingId:1,code:'O1',status:'DELIVERED',totalAmount:100000,remainingAmount:0,escrow:{id:1,orderId:1,status:'HELD',amount:100000},timeline:[{status:'DELIVERED',createdAt:new Date()}],dispute:null},listingStatus:'RESERVED'};
  const client={$queryRawUnsafe:async()=>{},wallet:{
    findUnique:async({where})=>state.wallets.find(w=>where.id?w.id===where.id:w.userId===where.userId),
    upsert:async({where})=>state.wallets.find(w=>w.userId===where.userId),
    updateMany:async({where,data})=>{const w=state.wallets.find(w=>w.id===where.id);if(!w||where.balance&&w.balance<where.balance.gte||where.pendingBalance&&w.pendingBalance<where.pendingBalance.gte)return{count:0};for(const[k,v]of Object.entries(data))w[k]+=(v.increment||0)-(v.decrement||0);return{count:1};}},
    bankAccount:{findFirst:async({where})=>where.id===1?{id:1,bankName:'QA Bank',accountNumber:'000001',accountName:'QA'}:null},feeConfig:{findFirst:async()=>({amount:1000})},
    walletTransaction:{create:async({data})=>{state.ledger.push(data);return data;}},auditLog:{create:async()=>{}},notification:{create:async()=>{}},orderTimeline:{create:async()=>{}},
    withdrawalRequest:{findUnique:async({where})=>state.withdrawals.find(w=>where.id?w.id===where.id:w.userId===where.userId_requestKey.userId&&w.requestKey===where.userId_requestKey.requestKey),create:async({data})=>{const w={id:state.withdrawals.length+1,status:'PENDING',...data};state.withdrawals.push(w);return w;},update:async({where,data})=>{const w=state.withdrawals.find(w=>w.id===where.id);Object.assign(w,data);return w;}},
    order:{findUnique:async()=>({...state.order,returnRequest:state.returns[0]||null}),update:async({data})=>{Object.assign(state.order,data);return state.order;}},
    returnRequest:{findUnique:async({where,include})=>{const r=state.returns.find(r=>where.id?r.id===where.id:r.orderId===where.orderId);return r?{...r,...(include?{order:state.order}:{})}:null;},create:async({data})=>{const r={id:1,status:'REQUESTED',...data};state.returns.push(r);return r;},update:async({where,data})=>{const r=state.returns.find(r=>r.id===where.id);Object.assign(r,data);return r;}},
    escrow:{updateMany:async({where,data})=>{const e=state.order.escrow;if(e.status!==where.status||e.amount!==where.amount)return{count:0};Object.assign(e,data);return{count:1};}},
    listing:{updateMany:async({data})=>{state.listingStatus=data.status;return{count:1};}}
  };
  let queue=Promise.resolve();client.$transaction=fn=>{const task=queue.then(async()=>{const prior=structuredClone(state);try{return await fn(client);}catch(e){state=prior;throw e;}});queue=task.catch(()=>{});return task;};
  return{client,get state(){return state;}};
}
const admin={id:9,roles:['ADMIN_FINANCE']},seller={id:2,roles:['SELLER']},buyer={id:1,roles:['BUYER']};
test('role management requires explicit permission and forbids self edit',()=>{
  assert.throws(()=>assertRoleManager({id:1,roles:['ADMIN_CONTENT'],canManageRoles:true},2),e=>e.status===403);
  assert.throws(()=>assertRoleManager({id:1,roles:['ADMIN_FINANCE'],canManageRoles:true},1),e=>e.status===403);
  assertRoleManager({id:1,roles:['ADMIN_FINANCE'],canManageRoles:true},2);
});
test('withdrawal retry holds once, then payment writes principal and actual fee once',async()=>{
  const db=database(),input={amount:50000,bankAccountId:1,requestKey:'one-key'};
  const [a,b]=await Promise.all([requestWithdrawal(db.client,1,input),requestWithdrawal(db.client,1,input)]);
  assert.equal(a.id,b.id);assert.equal(db.state.wallets[0].balance,249000);assert.equal(db.state.wallets[0].pendingBalance,51000);assert.equal(db.state.ledger.length,0);
  await assert.rejects(transitionWithdrawal(db.client,admin,a.id,{action:'PAY',transferReference:'QA'}),e=>e.status===409);
  await transitionWithdrawal(db.client,admin,a.id,{action:'APPROVE',resolution:'Reviewed'});
  await assert.rejects(transitionWithdrawal(db.client,admin,a.id,{action:'PAY'}),e=>e.status===400);
  await transitionWithdrawal(db.client,admin,a.id,{action:'PAY',transferReference:'QA-TRANSFER',resolution:'Paid'});
  await assert.rejects(transitionWithdrawal(db.client,admin,a.id,{action:'PAY',transferReference:'QA-TRANSFER'}),e=>e.status===409);
  assert.equal(db.state.wallets[0].pendingBalance,0);assert.deepEqual(db.state.ledger.map(x=>x.amount),[-50000,-1000]);assert.equal(db.state.ledger[1].balanceAfter,249000);
});
test('withdrawal rejection returns all held money and another user cannot cancel',async()=>{
  const db=database(),r=await requestWithdrawal(db.client,1,{amount:50000,bankAccountId:1,requestKey:'key'});
  await assert.rejects(transitionWithdrawal(db.client,seller,r.id,{action:'CANCEL'}),e=>e.status===403);
  await transitionWithdrawal(db.client,admin,r.id,{action:'REJECT',resolution:'Rejected'});
  assert.equal(db.state.wallets[0].balance,300000);assert.equal(db.state.wallets[0].pendingBalance,0);assert.equal(db.state.ledger.length,0);
  await assert.rejects(requestWithdrawal(db.client,1,{amount:60000,bankAccountId:1,requestKey:'key'}),e=>e.status===409);
});
test('return cannot skip receipt, refund twice or change another buyers order',async()=>{
  const db=database();await assert.rejects(requestReturn(db.client,3,1,{reason:'Wrong item'}),e=>e.status===404);
  const r=await requestReturn(db.client,1,1,{reason:'Wrong item'});assert.equal(db.state.order.status,'DISPUTED');
  await assert.rejects(transitionReturn(db.client,admin,r.id,{action:'REFUND'}),e=>e.status===409);
  await transitionReturn(db.client,seller,r.id,{action:'APPROVE'});
  await transitionReturn(db.client,buyer,r.id,{action:'SHIP',trackingCode:'QA123'});
  await assert.rejects(transitionReturn(db.client,buyer,r.id,{action:'RECEIVE',note:'Received'}),e=>e.status===403);
  await transitionReturn(db.client,seller,r.id,{action:'RECEIVE',note:'Received intact'});
  const results=await Promise.allSettled([transitionReturn(db.client,admin,r.id,{action:'REFUND'}),transitionReturn(db.client,admin,r.id,{action:'REFUND'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(db.state.wallets[0].balance,400000);assert.equal(db.state.order.escrow.status,'REFUNDED');assert.equal(db.state.listingStatus,'HIDDEN');
});
test('released escrow return holds seller funds and COD requires buyer confirmation',async()=>{
  const db=database();Object.assign(db.state.order,{status:'COMPLETED',codCollectedAt:new Date(),totalAmount:180000});db.state.order.escrow.status='RELEASED';
  const r=await requestReturn(db.client,1,1,{reason:'Wrong item'});
  await transitionReturn(db.client,seller,r.id,{action:'APPROVE'});assert.equal(db.state.wallets[1].pendingBalance,100000);
  await transitionReturn(db.client,buyer,r.id,{action:'SHIP',trackingCode:'QA'});await transitionReturn(db.client,seller,r.id,{action:'RECEIVE',note:'Received'});
  await assert.rejects(transitionReturn(db.client,admin,r.id,{action:'REFUND'}),e=>e.status===409);
  await transitionReturn(db.client,seller,r.id,{action:'COD_REFUND',codReference:'QA-CASH'});await transitionReturn(db.client,buyer,r.id,{action:'COD_CONFIRM'});
  await transitionReturn(db.client,admin,r.id,{action:'REFUND'});
  assert.equal(db.state.wallets[1].pendingBalance,0);assert.equal(db.state.wallets[1].balance,100000);assert.equal(db.state.wallets[0].balance,400000);assert.equal(db.state.ledger[0].amount,-100000);assert.equal(db.state.ledger.at(-1).amount,100000);
});
test('return window and response metrics have honest boundaries',()=>{
  assert.throws(()=>checkReturnWindow({timeline:[{status:'DELIVERED',createdAt:new Date(Date.now()-8*86400000)}]}),e=>e.status===400);
  assert.equal(responseStats([]).responseRate,null);
  const stats=responseStats([{incoming:true,otherId:1,listingId:1,createdAt:0},{incoming:true,otherId:1,listingId:1,createdAt:1000},{incoming:false,otherId:1,listingId:1,createdAt:60000},{incoming:true,otherId:2,listingId:1,createdAt:120000}]);
  assert.equal(stats.inquiries,2);assert.equal(stats.responses,1);assert.equal(stats.responseRate,50);assert.equal(stats.medianResponseSeconds,60);
});
test('account quota is checked atomically by user, even across concurrent requests',async()=>{
  let count=0;const client={$transaction:fn=>fn({actionQuota:{upsert:async()=>{},updateMany:async({where})=>{if(count>=where.count.lt)return{count:0};count++;return{count:1};}}})};
  const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/guards'),'utf8'),{module,require:n=>n==='../prisma'?client:{asyncHandler:f=>f},Date,Math});
  const middleware=module.exports.accountLimit('TEST',2,60000);let passed=0;const statuses=[];
  await Promise.all(Array.from({length:3},()=>middleware({user:{id:1}},{set(){},status(c){statuses.push(c);return this;},json(){}},()=>passed++)));
  assert.equal(passed,2);assert.deepEqual(statuses,[429]);
});
test('private evidence is restricted to owner, order parties and finance admin',async()=>{
  const url='http://localhost:4000/api/v1/upload/evidence/1-12345678-1234-1234-1234-123456789abc.png';
  const client={returnRequest:{findFirst:async()=>null},disputeEvidence:{findFirst:async()=>null}};
  assert.equal(evidenceName(url),'1-12345678-1234-1234-1234-123456789abc.png');
  assert.equal(await mayReadEvidence(client,{id:1,roles:['BUYER']},url),true);
  assert.equal(await mayReadEvidence(client,{id:9,roles:['ADMIN_FINANCE']},url),true);
  assert.equal(await mayReadEvidence(client,{id:2,roles:['ADMIN_CONTENT']},url),false);
  client.returnRequest.findFirst=async({where})=>where.order.OR.some(p=>p.sellerId===2)?{id:1}:null;
  assert.equal(await mayReadEvidence(client,{id:2,roles:['SELLER']},url),true);
  assert.throws(()=>evidenceName(url+'?other=1'),e=>e.status===400);
});
