// Opt-in integration checks create synthetic fixtures on the local development server.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const BASE=process.env.BASE_URL||'http://localhost:4000';
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Chỉ chạy QA trên localhost.');
const tag=Date.now().toString(36),users=[],listings=[],orders=[];
let content,finance,buyer,seller,privateEvidence;
async function api(endpoint,{method='GET',token,body,expected=200}={}){
  const r=await fetch(BASE+'/api/v1'+endpoint,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const data=await r.json();assert.ok([].concat(expected).includes(r.status),`${method} ${endpoint}: ${r.status} — ${data.message||'unexpected response'}`);return data;
}
const post=(endpoint,token,body,expected=200)=>api(endpoint,{method:'POST',token,body,expected});
const patch=(endpoint,token,body,expected=200)=>api(endpoint,{method:'PATCH',token,body,expected});
async function login(email,password){return post('/auth/login',null,{email,password});}
async function fixture(label){
  const email=`qa-${tag}-${label.toLowerCase()}@example.test`,password='QA-'+randomUUID();
  const r=await post('/auth/register',null,{fullName:`QA ${tag} ${label}`,email,password},201);
  const u={...r.user,email,password,token:r.token};users.push(u);
  await patch('/admin/users/'+u.id+'/verify',content.token,{});
  return u;
}
async function mailToken(email,purpose){
  const directory=path.join(__dirname,'../.local/mail');
  const files=await fs.readdir(directory);
  for(const name of files.reverse()){
    const m=JSON.parse(await fs.readFile(path.join(directory,name),'utf8'));
    if(m.to!==email)continue;
    const match=m.text.match(new RegExp('#/'+purpose+'/([a-f0-9]{64})'));
    if(match)return match[1];
  }
  throw Error('Không tìm thấy thư QA trong hộp thư local');
}
async function createListing(){
  const r=await post('/listings',seller.token,{title:`QA ${tag} sản phẩm ${listings.length+1}`,description:'Sản phẩm kiểm thử tự động. Không bán thật.',categoryId:1,price:100000,condition:'USED_GOOD',images:[BASE+'/assets/products/aula-win60-he.webp'],city:'QA City',deliveryMethod:'ANY',specifications:{brand:'QA',model:'Fixture'}},201);
  listings.push(r.listing.id);await patch('/listings/admin/'+r.listing.id+'/moderate',content.token,{action:'APPROVE'});return r.listing.id;
}
async function createOrder(listingId){const o=await post('/orders',buyer.token,{listingId,shipName:'QA Buyer',shipPhone:'0900000000',shipAddress:'QA address',paymentMethod:'SAFEPAY_WALLET'},201);orders.push(o.id);return o;}
async function deposit(o){return post('/escrow/orders/'+o.id+'/deposit',buyer.token,{paymentMethod:'SAFEPAY_WALLET'},201);}
async function deliver(o){for(const to of ['CONFIRMED','SHIPPING','DELIVERED'])await patch('/orders/'+o.id+'/status',seller.token,{to,trackingCode:'QA-DELIVERY'});}
const balance=async u=>api('/wallet',{token:u.token});
async function returnProgress(o,{completed=false,cod=false}={}){
  const original=await balance(buyer);await deposit(o);
  if(!cod)await post('/escrow/orders/'+o.id+'/pay-remainder',buyer.token,{});
  await deliver(o);
  if(cod)await post('/orders/'+o.id+'/confirm-cod',seller.token,{});
  if(completed)await patch('/orders/'+o.id+'/status',buyer.token,{to:'COMPLETED'});
  const r=await post('/returns/orders/'+o.id,buyer.token,{reason:'QA kiểm thử trả hàng không đúng mô tả',evidences:[privateEvidence]},201);
  assert.equal((await fetch(privateEvidence,{headers:{Authorization:'Bearer '+seller.token}})).status,200);
  await patch('/returns/'+r.id,buyer.token,{action:'REFUND',note:'QA forbidden'},403);
  await patch('/returns/'+r.id,finance.token,{action:'REFUND',note:'QA skip receipt'},409);
  if(completed){
    await patch('/returns/'+r.id,seller.token,{action:'APPROVE',note:'QA lacks funds'},400);
    await post('/wallet/topup',seller.token,{amount:10000,method:'QA'});
  }
  await patch('/returns/'+r.id,seller.token,{action:'APPROVE',note:'QA reviewed'});
  await patch('/returns/'+r.id,buyer.token,{action:'SHIP',trackingCode:'QA-RETURN'});
  await patch('/returns/'+r.id,seller.token,{action:'RECEIVE',note:'QA nhận đủ hàng trả'});
  if(cod){
    await patch('/returns/'+r.id,finance.token,{action:'REFUND',note:'QA COD not confirmed'},409);
    await patch('/returns/'+r.id,seller.token,{action:'COD_REFUND',codReference:'QA-SIMULATED-CASH'});
    await patch('/returns/'+r.id,buyer.token,{action:'COD_CONFIRM'});
  }
  await patch('/returns/'+r.id,finance.token,{action:'REFUND',note:'QA nhận hàng và đối soát'});
  await patch('/returns/'+r.id,finance.token,{action:'REFUND',note:'QA duplicate'},409);
  assert.equal((await balance(buyer)).balance,original.balance);
  assert.equal((await api('/orders/'+o.id,{token:buyer.token})).returnRequest.status,'REFUNDED');
}
async function main(){
  const config=await api('/auth/config');assert.equal(config.emailMode,'LOCAL_OUTBOX','QA cần development và hộp thư local; không gửi email thật.');
  content=await login('content@nola2hand.vn','123456');finance=await login('finance@nola2hand.vn','123456');
  await patch('/admin/users/'+content.user.id+'/roles',content.token,{roles:['ADMIN_CONTENT','ADMIN_FINANCE']},403);
  await patch('/admin/users/'+finance.user.id+'/roles',finance.token,{roles:['ADMIN_FINANCE']},403);
  await patch('/admin/users/'+finance.user.id+'/lock',content.token,{reason:'QA denied'},403);
  console.log('PASS phân quyền: không tự nâng quyền, không khóa admin bằng quyền nội dung');
  buyer=await fixture('Buyer');seller=await fixture('Seller');
  await post('/users/me/become-seller',seller.token,{shopName:`QA ${tag} Shop`},201);
  const verifyToken=await mailToken(buyer.email,'verify');await post('/auth/verify-email',null,{token:verifyToken});await post('/auth/verify-email',null,{token:verifyToken},400);
  const oldToken=buyer.token,newPassword='QA-new-'+randomUUID();await post('/auth/change-password',oldToken,{currentPassword:buyer.password,newPassword});await api('/auth/me',{token:oldToken,expected:401});buyer.password=newPassword;buyer.token=(await login(buyer.email,newPassword)).token;
  const beforeReset=buyer.token;await post('/auth/forgot-password',null,{email:buyer.email});const resetToken=await mailToken(buyer.email,'reset');buyer.password='QA-reset-'+randomUUID();await post('/auth/reset-password',null,{resetToken,newPassword:buyer.password});await api('/auth/me',{token:beforeReset,expected:401});buyer.token=(await login(buyer.email,buyer.password)).token;
  const beforeLogout=buyer.token;await post('/auth/logout',beforeLogout,{});await api('/auth/me',{token:beforeLogout,expected:401});buyer.token=(await login(buyer.email,buyer.password)).token;
  console.log('PASS phiên: xác nhận email một lần; đổi/reset mật khẩu và logout thu hồi token cũ');
  const image=await post('/upload',buyer.token,{purpose:'EVIDENCE',mimeType:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jTzQAAAAASUVORK5CYII='},201);privateEvidence=image.url;
  assert.equal((await fetch(privateEvidence)).status,401);assert.equal((await fetch(privateEvidence,{headers:{Authorization:'Bearer '+buyer.token}})).status,200);assert.equal((await fetch(privateEvidence,{headers:{Authorization:'Bearer '+seller.token}})).status,403);assert.equal((await fetch(privateEvidence,{headers:{Authorization:'Bearer '+content.token}})).status,403);
  console.log('PASS ảnh bằng chứng riêng: cần đăng nhập và quyền owner/đơn liên quan');
  await post('/wallet/topup',buyer.token,{amount:2000000,method:'QA'});
  const bank=await post('/wallet/banks',buyer.token,{bankName:'QA Bank',accountNumber:'0000001234',accountName:'QA Buyer'},201);
  let initial=await balance(buyer);const input={amount:50000,bankAccountId:bank.id,requestKey:randomUUID()};const w=await post('/wallet/withdraw',buyer.token,input,201);const retry=await post('/wallet/withdraw',buyer.token,input,201);assert.equal(w.request.id,retry.request.id);assert.equal((await balance(buyer)).pendingBalance,50000+w.request.fee);
  await patch('/admin/finance/withdrawals/'+w.request.id,content.token,{action:'APPROVE',resolution:'QA denied'},403);
  await patch('/admin/finance/withdrawals/'+w.request.id,finance.token,{action:'APPROVE',resolution:'QA reviewed'});
  await patch('/admin/finance/withdrawals/'+w.request.id,finance.token,{action:'PAY',resolution:'QA missing receipt'},400);
  await patch('/admin/finance/withdrawals/'+w.request.id,finance.token,{action:'PAY',resolution:'QA simulated transfer only',transferReference:'QA-SIMULATION-'+tag});
  await patch('/admin/finance/withdrawals/'+w.request.id,finance.token,{action:'PAY',resolution:'QA duplicate',transferReference:'QA-SIMULATION-'+tag},409);
  assert.equal((await balance(buyer)).pendingBalance,0);assert.equal((await balance(buyer)).balance,initial.balance-50000-w.request.fee);
  initial=await balance(buyer);const reject=await post('/wallet/withdraw',buyer.token,{...input,requestKey:randomUUID()},201);await patch('/admin/finance/withdrawals/'+reject.request.id,finance.token,{action:'REJECT',resolution:'QA rejection'});assert.equal((await balance(buyer)).balance,initial.balance);
  console.log('PASS rút tiền: retry giữ một lần; duyệt/chứng từ/ghi sổ và từ chối hoàn giữ');
  for(const concurrent of [false,true]){
    const o=await createOrder(await createListing()),start=await balance(buyer);await deposit(o);const d=await api('/orders/'+o.id,{token:buyer.token});
    if(concurrent)await Promise.all([post('/escrow/orders/'+o.id+'/pay-remainder',buyer.token,{},[200,400,409]),post('/escrow/'+d.escrow.id+'/refund',seller.token,{reason:'QA refund race'})]);
    else{await post('/escrow/orders/'+o.id+'/pay-remainder',buyer.token,{});await post('/escrow/'+d.escrow.id+'/refund',seller.token,{reason:'QA fresh amount'});}
    assert.equal((await balance(buyer)).balance,start.balance);assert.equal((await api('/orders/'+o.id,{token:buyer.token})).status,'REFUNDED');
  }
  console.log('PASS PostgreSQL: hoàn đủ tiền sau thanh toán còn lại, kể cả chạy đồng thời');
  await returnProgress(await createOrder(await createListing()));
  await returnProgress(await createOrder(await createListing()),{completed:true});
  await returnProgress(await createOrder(await createListing()),{cod:true});
  console.log('PASS trả hàng: đủ bước; sau giải ngân giữ tiền seller; COD ngoài ví không cộng lại; chống hoàn hai lần');
  const pending=[];for(let i=0;i<4;i++){const listing=await createListing();if(i<3)pending.push(await createOrder(listing));else await post('/orders',buyer.token,{listingId:listing,shipName:'QA',shipPhone:'0900000000',shipAddress:'QA'},429);}
  for(const o of pending)await patch('/orders/'+o.id+'/status',buyer.token,{to:'CANCELLED',note:'QA cleanup cap'});
  await post('/chat/blocks/'+seller.id,buyer.token,{});await post('/chat/messages',seller.token,{receiverId:buyer.id,body:'QA blocked'},403);await api('/chat/blocks/'+seller.id,{method:'DELETE',token:buyer.token});
  console.log('PASS chống giữ hàng và chặn liên lạc');
  const reputation=await api('/shops/'+seller.id);assert.equal(reputation.reputation.identityVerified,true);assert.equal(reputation.reputation.emailVerified,false);assert.equal(reputation.reputation.returnedOrders,3);assert.equal(reputation.reputation.responseRate,null);
  const active=await api('/seller/listings?limit=100',{token:seller.token});const ids=active.data.filter(l=>l.status==='ACTIVE').slice(0,3).map(l=>l.id);assert.equal(ids.length,3);const compare=await api('/listings/compare?ids='+ids.join(','));assert.equal(compare.items.length,3);assert.ok(compare.items.every(l=>l.priceHistory.length>0));await api('/listings/compare?ids='+[...ids,999999].join(','),{expected:400});
  console.log('PASS uy tín và so sánh: dữ liệu đo thực; tối đa 3 tin ACTIVE có lịch sử');
}
async function cleanup(){
  if(seller)for(const id of listings){try{const l=await api('/seller/listings/'+id,{token:seller.token});if(['ACTIVE','HIDDEN','DRAFT','PENDING_REVIEW','REJECTED'].includes(l.status))await api('/listings/'+id,{method:'DELETE',token:seller.token});}catch{/* Preserve failed fixtures for diagnosis. */}}
  if(content)for(const user of users){try{await patch('/admin/users/'+user.id+'/lock',content.token,{reason:'QA fixture completed; not a real user'});}catch{}}
}
main().then(()=>console.log('ALL SECURE WORKFLOW CHECKS PASSED')).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(cleanup);
