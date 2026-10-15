const WORKFLOW_LABELS = {PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',PAID:'Đã chuyển khoản',REJECTED:'Từ chối',FAILED:'Chuyển thất bại',CANCELLED:'Đã hủy',REQUESTED:'Yêu cầu trả hàng',SHIPPED:'Đã gửi trả',RECEIVED:'Đã nhận hàng trả',REFUNDED:'Đã hoàn tiền'};
function workflowBadge(status){return `<span class="badge ${['PAID','REFUNDED'].includes(status)?'b-green':['REJECTED','FAILED','CANCELLED'].includes(status)?'b-gray':'b-amber'}">${esc(WORKFLOW_LABELS[status]||status)}</span>`;}

/* Security and money screens reuse existing dialogs and paging. */
let withdrawalKey;
const baseWithdrawModal=withdrawModal;
withdrawModal=()=>{withdrawalKey=crypto.randomUUID();baseWithdrawModal();};
doWithdraw=async()=>{
  const button=$('#modal-root .btn-green');if(button?.disabled)return;
  if(button)button.disabled=true;
  try{const result=await api('/wallet/withdraw',{method:'POST',body:{amount:+$('#wd-amt').value,bankAccountId:+$('#wd-bank').value,requestKey:withdrawalKey}});closeModal();withdrawalKey=null;toast(result.message,'ok');await render();}
  catch(e){toast(e.message,'err');}finally{if(button)button.disabled=false;}
};
const baseWalletRoute=routes.wallet;
routes.wallet=async()=>{await baseWalletRoute();if(!store.token)return;$('#app .wrap').insertAdjacentHTML('beforeend','<section class="sect"><h2>Yêu cầu rút tiền</h2><p class="muted">Tiền được giữ tới khi admin chuyển khoản hoặc từ chối. Chưa chuyển tiền sẽ chưa ghi giao dịch thành công.</p><div id="withdrawal-requests"></div></section>');await myWithdrawals();};
function withdrawalCard(w,admin=false){
  const canHandle=admin&&w.userId!==store.user.id;
  return `<article class="workflow-card"><h3>${esc(w.user?.fullName||w.reference)}</h3>${workflowBadge(w.status)}<p>Rút ${fmtVND(w.amount)} · phí ${fmtVND(w.fee)}</p><p>${esc(w.bankName)} · ${admin?esc(w.accountNumber):'****'+esc(w.accountNumber.slice(-4))} · ${esc(w.accountName)}</p><p class="muted">${fmtDate(w.createdAt)}${w.paidAt?' · chuyển '+fmtDate(w.paidAt):''}</p>${w.resolution?`<p>${esc(w.resolution)}</p>`:''}${w.transferReference?`<p>Chứng từ: ${esc(w.transferReference)}</p>`:''}<div class="workflow-actions">${canHandle&&w.status==='PENDING'?`<button class="btn btn-green btn-sm" onclick="withdrawalAction(${w.id},'APPROVE')">Duyệt</button>`:''}${canHandle&&w.status==='APPROVED'?`<button class="btn btn-green btn-sm" onclick="withdrawalAction(${w.id},'PAY')">Ghi nhận đã chuyển</button><button class="btn btn-line btn-sm" onclick="withdrawalAction(${w.id},'FAIL')">Chuyển thất bại</button>`:''}${canHandle&&['PENDING','APPROVED'].includes(w.status)?`<button class="btn btn-line btn-sm" onclick="withdrawalAction(${w.id},'REJECT')">Từ chối và hoàn giữ</button>`:''}${!admin&&w.status==='PENDING'?`<button class="btn btn-line btn-sm" onclick="cancelWithdrawal(${w.id})">Hủy yêu cầu</button>`:''}</div></article>`;
}
async function myWithdrawals(page=1){const d=await api('/wallet/withdrawals?page='+page+'&limit=10');$('#withdrawal-requests').innerHTML=d.data.map(w=>withdrawalCard(w)).join('')||'<p class="muted">Chưa có yêu cầu.</p>';$('#withdrawal-requests').innerHTML+=pagination(d.meta,'myWithdrawals');}
async function cancelWithdrawal(id){if(!confirm('Hủy yêu cầu và trả tiền đang giữ về số dư khả dụng?'))return;try{await api('/wallet/withdrawals/'+id+'/cancel',{method:'PATCH'});toast('Đã hủy và hoàn tiền giữ','ok');await render();}catch(e){toast(e.message,'err');}}
async function withdrawalAction(id,action){
  const resolution=prompt('Lý do / ghi chú xử lý:');if(!resolution?.trim())return;
  const transferReference=action==='PAY'?prompt('Mã chứng từ chuyển khoản thực tế:'):undefined;if(action==='PAY'&&!transferReference?.trim())return;
  try{await api('/admin/finance/withdrawals/'+id,{method:'PATCH',body:{action,resolution,transferReference}});toast('Đã cập nhật yêu cầu','ok');await render();}catch(e){toast(e.message,'err');}
}
ADMIN_TABS.finance.push(['withdrawals','💸 Yêu cầu rút tiền'],['permissions','🔐 Phân quyền'],['returns','↩️ Trả hàng']);
adminLists.withdrawals={url:'/admin/finance/withdrawals',title:'Yêu cầu rút tiền',statuses:['PENDING','APPROVED','PAID','REJECTED','FAILED','CANCELLED'],render:w=>withdrawalCard(w,true)};
ADMIN_VIEWS['finance:withdrawals']=()=>openAdminList('withdrawals');
ADMIN_VIEWS['finance:permissions']=async()=>{
  if(!store.user.canManageRoles)throw new Error('Cần quyền quản lý phân quyền riêng');
  $('#abody').innerHTML='<h2>Phân quyền tài khoản</h2><p class="muted">Không được đổi quyền của chính mình. Đổi role thu hồi phiên của tài khoản được sửa.</p><div id="permission-users"></div>';await permissionUsers();
};
async function permissionUsers(page=1){const d=await api('/admin/users?page='+page+'&limit=10');$('#permission-users').innerHTML=d.data.map(u=>`<article class="workflow-card"><b>${esc(u.fullName)}</b><p>${esc(u.email)} · ${esc(u.roles.join(', '))}</p><button class="btn btn-line btn-sm" ${u.id===store.user.id?'disabled':''} onclick="rolesModal(${u.id},${esc(JSON.stringify(u.roles))})">Đổi vai trò</button></article>`).join('')+pagination(d.meta,'permissionUsers');}
function rolesModal(id,existing=[]){openModal(`<h2>Chọn vai trò</h2><p class="muted">Chọn đầy đủ các vai trò cần giữ cho tài khoản.</p>${Object.entries({BUYER:'Người mua',SELLER:'Người bán',ADMIN_CONTENT:'Admin nội dung',ADMIN_FINANCE:'Admin tài chính'}).map(([r,label])=>`<label class="role-option"><input type="checkbox" name="new-role" value="${r}" ${existing.includes(r)?'checked':''}> ${label}</label>`).join('')}<button class="btn btn-green" onclick="saveRoles(${id})">Lưu vai trò</button>`);}
async function saveRoles(id){const roles=[...document.querySelectorAll('[name="new-role"]:checked')].map(x=>x.value);if(!roles.length){toast('Chọn ít nhất một vai trò','err');return;}try{await api('/admin/users/'+id+'/roles',{method:'PATCH',body:{roles}});closeModal();toast('Đã đổi quyền và thu hồi phiên cũ','ok');await render();}catch(e){toast(e.message,'err');}}
const baseProfileRoute=routes.profile;
routes.profile=async()=>{await baseProfileRoute();if(!store.token)return;$('#app .wrap').insertAdjacentHTML('beforeend','<section class="sect"><h2>Bảo mật tài khoản</h2><button class="btn btn-line" onclick="passwordModal()">Đổi mật khẩu và đăng xuất mọi thiết bị</button></section>');};
function passwordModal(){openModal('<h2>Đổi mật khẩu</h2><form onsubmit="changePassword(event)"><label class="lbl" for="current-password">Mật khẩu hiện tại</label><input class="input" id="current-password" type="password" required autocomplete="current-password"><label class="lbl" for="new-password">Mật khẩu mới (8–72 ký tự, có cả chữ và số)</label><input class="input" id="new-password" type="password" required minlength="8" maxlength="72" autocomplete="new-password"><button class="btn btn-green">Lưu và thu hồi phiên cũ</button></form>');}
async function changePassword(e){e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const r=await api('/auth/change-password',{method:'POST',body:{currentPassword:$('#current-password').value,newPassword:$('#new-password').value}});closeModal();clearSession();toast(r.message,'ok');}catch(err){toast(err.message,'err');}finally{b.disabled=false;}}
const baseOpenThread=openThread;
openThread=async(userId,listingId)=>{await baseOpenThread(userId,listingId);$('#thread').insertAdjacentHTML('afterbegin',`<button class="btn btn-line btn-sm" onclick="blockChatUser(${userId})">Chặn liên lạc</button>`);};
async function blockChatUser(id){if(!confirm('Chặn gửi/nhận tin nhắn với tài khoản này?'))return;try{await api('/chat/blocks/'+id,{method:'POST'});toast('Đã chặn liên lạc','ok');await render();}catch(e){toast(e.message,'err');}}
const baseChatRoute=routes.chat;
routes.chat=async()=>{await baseChatRoute();if(!store.token)return;const blocked=await api('/chat/blocks');$('#app .wrap').insertAdjacentHTML('beforeend',`<section class="sect"><h2>Đã chặn liên lạc</h2>${blocked.map(u=>`<p>${esc(u.fullName)} <button class="btn btn-line btn-sm" onclick="unblockChatUser(${u.id})">Bỏ chặn</button></p>`).join('')||'<p class="muted">Chưa chặn tài khoản nào.</p>'}</section>`);};
async function unblockChatUser(id){try{await api('/chat/blocks/'+id,{method:'DELETE'});await render();}catch(e){toast(e.message,'err');}}

/* Return progress keeps external COD separate from SafePay. */
function returnCard(r){
  const o=r.order,buyer=store.user.id===o.buyerId,seller=store.user.id===o.sellerId,admin=hasRole('ADMIN_FINANCE')&&!buyer&&!seller;
  const button=(action,label,green=false)=>`<button class="btn ${green?'btn-green':'btn-line'} btn-sm" onclick="returnAction(${r.id},'${action}',${r.codAmount})">${label}</button>`;
  let actions='';
  if(r.status==='REQUESTED'){if(seller||admin)actions+=button('APPROVE','Duyệt trả hàng',true)+button('REJECT','Từ chối');if(buyer)actions+=button('CANCEL','Hủy yêu cầu');}
  if(r.status==='APPROVED'&&buyer)actions+=button('SHIP','Đã gửi trả / bàn giao',true);
  if(r.status==='SHIPPED'&&(seller||admin))actions+=button('RECEIVE','Xác nhận đã nhận hàng trả',true);
  if(r.status==='RECEIVED'){
    if(seller&&r.codAmount>0&&!r.codRefundedAt)actions+=button('COD_REFUND','Ghi nhận hoàn COD ngoài ví');
    if(buyer&&r.codRefundedAt&&!r.codConfirmedAt)actions+=button('COD_CONFIRM','Tôi đã nhận lại tiền COD',true);
    if(admin)actions+=button('REFUND','Hoàn tiền SafePay',true);
  }
  return `<article class="workflow-card"><h3><a href="#/orders/${o.id}">Đơn ${esc(o.code)}</a> · ${esc(o.listing?.title||'')}</h3>${workflowBadge(r.status)}<ol class="return-progress">${['REQUESTED','APPROVED','SHIPPED','RECEIVED','REFUNDED'].map(s=>`<li class="${s===r.status?'on':''}">${WORKFLOW_LABELS[s]}</li>`).join('')}</ol><p>${esc(r.reason)}</p><p>Hoàn vào ví: <b>${fmtVND(r.refundAmount)}</b>${r.codAmount?` · COD hoàn ngoài ví: <b>${fmtVND(r.codAmount)}</b>`:''}</p><p class="muted">Người mua: ${esc(o.buyer?.fullName||'')} · Người bán: ${esc(o.seller?.fullName||'')} · ${fmtDate(r.requestedAt)}</p>${r.trackingCode?`<p>Gửi trả: ${esc(r.trackingCode)}</p>`:''}${r.receivedNote?`<p>Nhận lại: ${esc(r.receivedNote)}</p>`:''}${r.codReference?`<p>Chứng từ COD: ${esc(r.codReference)} · ${r.codConfirmedAt?'buyer đã xác nhận':'chờ buyer xác nhận'}</p>`:''}${r.resolution?`<p>Ghi chú: ${esc(r.resolution)}</p>`:''}<div class="evidence-grid">${(r.evidences||[]).map(evidencePicture).join('')}</div><div class="workflow-actions">${actions}</div></article>`;
}
adminLists.returns={url:'/returns/admin',title:'Tiến trình trả hàng',statuses:['REQUESTED','APPROVED','SHIPPED','RECEIVED','REFUNDED','REJECTED','CANCELLED'],render:returnCard};
ADMIN_VIEWS['finance:returns']=()=>openAdminList('returns');
route('returns',async()=>{if(!store.token){location.hash='#/login';return;}$('#app').innerHTML='<div class="wrap"><h1>Trả hàng và hoàn tiền</h1><p class="muted">Yêu cầu trong 7 ngày sau khi giao hàng. Tiền chỉ hoàn sau khi hàng đã nhận lại. Phí sàn đã thu không tự hoàn.</p><div id="my-returns"></div></div>';await myReturns();});
async function myReturns(page=1){const d=await api('/returns?page='+page+'&limit=10');$('#my-returns').innerHTML=(d.data.map(returnCard).join('')||'<div class="empty">Chưa có yêu cầu trả hàng.</div>')+pagination(d.meta,'myReturns');await hydrateEvidenceImages($('#my-returns'));}
const baseOrdersRoute=routes.orders;
routes.orders=async id=>{await baseOrdersRoute(id);if(!store.token)return;const wrap=$('#app .wrap');wrap.insertAdjacentHTML('afterbegin','<p><a class="btn btn-line btn-sm" href="#/returns">Trả hàng và hoàn tiền →</a></p>');if(!id)return;const o=viewedOrder;
  if(o.returnRequest)wrap.insertAdjacentHTML('beforeend',`<section class="sect"><h2>Tiến trình trả hàng</h2>${returnCard({...o.returnRequest,order:o})}</section>`);
  else if(o.buyerId===store.user.id&&['DELIVERED','COMPLETED'].includes(o.status)&&!o.dispute)wrap.insertAdjacentHTML('beforeend',`<section class="sect"><h2>Trả hàng</h2><p class="muted">Trong 7 ngày sau khi giao; shop cần nhận lại hàng trước khi hoàn tiền.</p><button class="btn btn-line" onclick="returnModal(${o.id})">Yêu cầu trả hàng</button></section>`);
  await hydrateEvidenceImages(wrap);
};
function returnModal(id){openModal(`<h2>Yêu cầu trả hàng</h2><form onsubmit="submitReturn(event,${id})"><label class="lbl" for="return-reason">Lý do (tối thiểu 10 ký tự)</label><textarea class="input" id="return-reason" required minlength="10" maxlength="1000"></textarea><label class="lbl" for="return-images">Ảnh bằng chứng (URL mỗi dòng một ảnh, tối đa 5)</label><textarea class="input" id="return-images" rows="2"></textarea><input class="input" type="file" multiple accept="image/jpeg,image/png,image/webp" onchange="uploadImages(this,'return-images',5)"><button class="btn btn-green">Gửi yêu cầu</button></form>`);}
async function submitReturn(e,id){e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await api('/returns/orders/'+id,{method:'POST',body:{reason:$('#return-reason').value,evidences:$('#return-images').value.split('\n').map(s=>s.trim()).filter(Boolean)}});closeModal();toast('Đã gửi yêu cầu; đơn tạm dừng giải ngân','ok');await render();}catch(err){toast(err.message,'err');}finally{b.disabled=false;}}
async function returnAction(id,action,codAmount){
  const body={action};
  if(['APPROVE','REJECT','RECEIVE','REFUND'].includes(action)){body.note=prompt('Ghi lý do / tình trạng hàng nhận lại:');if(!body.note?.trim())return;}
  if(action==='SHIP'){body.trackingCode=prompt('Mã vận đơn hoặc thông tin bàn giao:');if(!body.trackingCode?.trim())return;}
  if(action==='COD_REFUND'){body.codReference=prompt(`Đã hoàn thực tế ${fmtVND(codAmount)} COD. Nhập chứng từ / hình thức hoàn:`);if(!body.codReference?.trim())return;}
  if(action==='COD_CONFIRM'&&!confirm(`Bạn đã thực nhận lại ${fmtVND(codAmount)} COD ngoài ví?`))return;
  if(action==='CANCEL'&&!confirm('Hủy yêu cầu trả hàng?'))return;
  try{await api('/returns/'+id,{method:'PATCH',body});toast('Đã cập nhật tiến trình','ok');await render();}catch(e){toast(e.message,'err');}
}

/* Shop reputation uses measured outcomes, never a default 100% response rate. */
const baseShopRoute=routes.shop;
routes.shop=async id=>{await baseShopRoute(id);if(!id)return;const r=viewedShop.reputation;
  $('#app .wrap').insertAdjacentHTML('beforeend',`<section class="sect"><h2>Hồ sơ uy tín shop</h2><div class="chips">${r.emailVerified?'<span class="badge b-blue">✓ Email đã xác nhận</span>':'<span class="badge b-gray">Email chưa xác nhận</span>'}${r.identityVerified?'<span class="badge b-green">✓ Danh tính đã duyệt</span>':'<span class="badge b-gray">Danh tính chưa được duyệt</span>'}</div><div class="stat-grid"><div class="stat"><div class="t">Đơn hoàn tất</div><div class="v">${r.completedOrders}</div></div><div class="stat"><div class="t">Tỷ lệ hủy</div><div class="v">${r.cancellationRate==null?'Chưa có đơn':r.cancellationRate+'%'}</div></div><div class="stat"><div class="t">Phản hồi 90 ngày</div><div class="v">${r.responseRate==null?'Chưa có dữ liệu':r.responseRate+'%'}</div></div><div class="stat"><div class="t">Thời gian phản hồi trung vị</div><div class="v">${r.medianResponseSeconds==null?'—':r.medianResponseSeconds<3600?Math.round(r.medianResponseSeconds/60)+' phút':(r.medianResponseSeconds/3600).toFixed(1)+' giờ'}</div></div></div><p class="muted">${r.totalOrders} đơn phát sinh · ${r.cancelledOrders} đơn hủy · ${r.returnedOrders} đơn trả hàng đã hoàn tiền. Tỷ lệ hủy gồm hủy bởi hai bên và hết hạn cọc, không phải kết luận lỗi của shop. Phản hồi tính ${r.inquiries} lượt hỏi (${r.responses} đã trả lời), tối đa 10.000 tin trong 90 ngày.</p></section>`);
};

/* Up to three comparison IDs survive reload and can be shared via URL. */
function comparisonIds(){try{const value=JSON.parse(localStorage.getItem('nola_compare')||'[]');return Array.isArray(value)?[...new Set(value.filter(n=>Number.isSafeInteger(n)&&n>0))].slice(0,3):[];}catch{return[];}}
function comparisonTray(){let tray=$('#comparison-tray');if(!tray){tray=document.createElement('aside');tray.id='comparison-tray';document.body.appendChild(tray);}const ids=comparisonIds();tray.hidden=!ids.length;tray.innerHTML=`<span>So sánh: ${ids.length}/3 sản phẩm</span><a class="btn btn-green btn-sm" href="#/compare?ids=${ids.join(',')}">Mở so sánh</a><button class="btn btn-line btn-sm" onclick="clearComparison()">Xóa chọn</button>`;}
function toggleComparison(id){let ids=comparisonIds();if(ids.includes(id))ids=ids.filter(n=>n!==id);else{if(ids.length>=3){toast('Chỉ so sánh tối đa 3 sản phẩm. Bỏ chọn một món trước.','err');return;}ids.push(id);}localStorage.setItem('nola_compare',JSON.stringify(ids));comparisonTray();toast(ids.includes(id)?'Đã thêm vào so sánh':'Đã bỏ khỏi so sánh','ok');}
function clearComparison(){localStorage.removeItem('nola_compare');comparisonTray();if(location.hash.startsWith('#/compare'))render();}
const baseListingCard=listingCard;
listingCard=l=>baseListingCard(l).replace('</article>',`<button class="btn btn-line btn-sm compare-button" onclick="toggleComparison(${l.id})">⇄ So sánh</button></article>`);
route('compare',async()=>{
  const query=new URLSearchParams(location.hash.split('?')[1]||''),raw=query.get('ids');
  const ids=raw?raw.split(',').map(Number):comparisonIds();
  if(!ids.length){$('#app').innerHTML='<div class="wrap empty"><h1>So sánh sản phẩm</h1><p>Chọn tối đa 3 món từ các thẻ sản phẩm.</p><a class="btn btn-green" href="#/">Chọn sản phẩm</a></div>';return;}
  if(ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!Number.isSafeInteger(id)||id<=0))throw new Error('Chọn 1–3 sản phẩm khác nhau');
  const [data,fields]=await Promise.all([api('/listings/compare?ids='+ids.join(','),{auth:false}),api('/categories/specifications',{auth:false})]);
  const items=data.items,keys=[...new Set(items.flatMap(l=>Object.keys(l.specifications||{})))];
  const row=(label,values)=>`<tr><th scope="row">${esc(label)}</th>${values.map(v=>`<td>${v}</td>`).join('')}</tr>`;
  const history=l=>l.priceHistory.length?`<p>Đầu: ${fmtVND(l.priceHistory[0].price)} → hiện tại ${fmtVND(l.price)}</p><details><summary>${l.priceHistory.length} lần ghi giá</summary>${l.priceHistory.map(p=>`<p>${fmtDate(p.createdAt)} · ${fmtVND(p.price)}</p>`).join('')}</details>`:'Chưa có lịch sử';
  $('#app').innerHTML=`<div class="wrap"><h1>So sánh tối đa 3 sản phẩm</h1><p class="muted">Thông số và tình trạng do seller cung cấp; lịch sử là giá niêm yết.</p>${data.unavailable.length?'<p role="status">Một số món đã không còn đang bán và được bỏ khỏi bảng.</p>':''}${items.length?`<div class="comparison-table"><table class="tbl"><thead><tr><th>Tiêu chí</th>${items.map(l=>`<th><img src="${img(l.images[0]?.url)}" alt="${esc(l.title)}"><a href="#/listing/${l.id}">${esc(l.title)}</a></th>`).join('')}</tr></thead><tbody>${row('Giá',items.map(l=>fmtVND(l.price)))}${row('Tình trạng',items.map(l=>esc(CONDITION_NAMES[l.condition])))}${row('Danh mục',items.map(l=>esc(l.category.name)))}${row('Địa điểm',items.map(l=>esc(l.city||'Chưa ghi')))}${row('Giao nhận',items.map(l=>esc(({ANY:'Giao hàng hoặc gặp trực tiếp',MEETUP:'Gặp trực tiếp',DELIVERY:'Giao hàng'})[l.deliveryMethod])))}${row('Shop',items.map(l=>`<a href="#/shop/${l.sellerId}">${esc(l.seller.fullName)}</a>${l.seller.idVerified?'<p>✓ Danh tính đã duyệt</p>':''}${l.seller.emailVerifiedAt?'<p>✓ Email đã xác nhận</p>':''}`))}${!keys.length?row('Thông số',items.map(()=> 'Seller chưa cung cấp')):''}${keys.map(key=>row(items.map(l=>fields[l.category.slug]?.[key]).find(Boolean)||key,items.map(l=>esc(l.specifications?.[key]||'—')))).join('')}${row('Lịch sử giá',items.map(history))}</tbody></table></div>`:'<div class="empty">Các món đã không còn đang bán.</div>'}<a class="btn btn-line" href="#/">Chọn thêm sản phẩm</a></div>`;
});
comparisonTray();

function isPrivateEvidence(url){try{const u=new URL(url,location.origin);return u.origin===location.origin&&u.pathname.startsWith('/api/v1/upload/evidence/');}catch{return false;}}
function evidencePicture(url){return isPrivateEvidence(url)?`<button class="btn btn-line" type="button" onclick="openEvidence(${esc(JSON.stringify(url))})"><img src="${IMG_PH}" data-evidence-url="${img(url)}" alt="Ảnh bằng chứng riêng"></button>`:`<a href="${img(url)}" target="_blank" rel="noopener"><img src="${img(url)}" alt="Ảnh bằng chứng"></a>`;}
async function evidenceBlob(url){if(!isPrivateEvidence(url)||!store.token)throw new Error('Không có quyền xem bằng chứng');const response=await fetch(url,{headers:{Authorization:'Bearer '+store.token}});if(!response.ok)throw new Error('Không tải được bằng chứng riêng');const result=URL.createObjectURL(await response.blob());window._evidenceUrls||=[];window._evidenceUrls.push(result);return result;}
async function hydrateEvidenceImages(root){if(!root)return;await Promise.all([...root.querySelectorAll('img[data-evidence-url]')].map(async image=>{try{image.src=await evidenceBlob(image.dataset.evidenceUrl);}catch{image.alt='Không tải được bằng chứng riêng';}}));}
async function openEvidence(url){try{const blob=await evidenceBlob(url);openModal(`<h2>Bằng chứng riêng</h2><img class="preview-photo" src="${blob}" alt="Bằng chứng"><button class="btn btn-line" onclick="closeModal()">Đóng</button>`);}catch(e){toast(e.message,'err');}}
const baseAdminListPage=adminListPage;
adminListPage=async page=>{await baseAdminListPage(page);await hydrateEvidenceImages($('#admin-results'));};
