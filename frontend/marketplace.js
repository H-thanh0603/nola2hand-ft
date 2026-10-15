/* Feature screens reuse the existing API, router, cards and dialogs. */
let specificationConfig;
async function renderSpecificationFields(values = {}) {
  specificationConfig ||= await api('/categories/specifications', { auth: false });
  const category = categories.find(c => c.id === +$('#nl-cat').value);
  const fields = specificationConfig[category?.slug] || {};
  $('#nl-specs').innerHTML = Object.keys(fields).length ? `<fieldset class="specification-form"><legend>Hồ sơ tình trạng sản phẩm</legend><p class="muted">Thông tin do người bán cung cấp. Hãy ghi rõ các lỗi và lịch sử sửa chữa.</p>${Object.entries(fields).map(([key, label]) => `<div class="form-row"><label class="lbl" for="spec-${key}">${esc(label)}</label><input class="input" id="spec-${key}" data-spec-key="${key}" value="${esc(values[key] || '')}" maxlength="250" ${['batteryHealth','width','depth','height','power'].includes(key) ? `type="number" min="0" step="any" ${key === 'batteryHealth' ? 'max="100"' : ''}` : ''}></div>`).join('')}</fieldset>` : '';
}
function listingSpecifications() {
  return Object.fromEntries([...document.querySelectorAll('[data-spec-key]')].filter(el => el.value.trim()).map(el => [el.dataset.specKey, el.value.trim()]));
}
async function uploadImages(input, target, max = 10) {
  const textarea = $('#' + target);
  const existing = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
  const files = [...input.files];
  if (files.length + existing.length > max) { toast(`Tối đa ${max} ảnh`, 'err'); input.value = ''; return; }
  if (files.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { toast('Chỉ nhận JPEG/PNG/WebP, tối đa 5MB mỗi ảnh', 'err'); input.value = ''; return; }
  input.disabled = true;
  const submit = input.closest('form')?.querySelector('button:not([type="button"])');
  if (submit) submit.disabled = true;
  try {
    for (const file of files) {
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await api('/upload', { method: 'POST', body: { mimeType: file.type, base64: data.split(',')[1], purpose: ['dp-images','return-images'].includes(target)?'EVIDENCE':'PRODUCT' } });
      existing.push(result.url); textarea.value = existing.join('\n');
      if (target === 'nl-imgs') renderNlPreviews();
    }
    toast('Đã tải ảnh lên máy chủ', 'ok');
  } catch (e) { toast(e.message, 'err'); }
  finally { input.disabled = false; input.value = ''; if (submit) submit.disabled = false; }
}
function nlImageUrls() { return ($('#nl-imgs')?.value || '').split('\n').map(s => s.trim()).filter(Boolean); }
function renderNlPreviews() {
  const box = $('#nl-preview'); if (!box) return;
  const urls = nlImageUrls();
  box.innerHTML = urls.map((u, i) => `<span style="position:relative;display:inline-block"><img src="${esc(u)}" alt="Ảnh ${i + 1}" onerror="this.src='${IMG_PH}'"><button type="button" class="btn btn-line btn-sm" style="position:absolute;top:2px;right:2px;padding:2px 8px" onclick="nlRemoveImage(${i})" aria-label="Xóa ảnh ${i + 1}">✕</button></span>`).join('') || '<p class="muted" style="font-size:12.5px">Chưa có ảnh nào. Ảnh đầu tiên làm ảnh bìa.</p>';
}
function nlRemoveImage(i) {
  const urls = nlImageUrls(); urls.splice(i, 1);
  $('#nl-imgs').value = urls.join('\n'); renderNlPreviews();
}
function previewListingForm() {
  const urls = $('#nl-imgs').value.split('\n').map(s => s.trim()).filter(Boolean);
  openModal(`<h2>${esc($('#nl-title').value || 'Tiêu đề sản phẩm')}</h2><img class="preview-photo" src="${img(urls[0])}" alt="Ảnh xem trước" onerror="this.src='${IMG_PH}'"><h3>${$('#nl-free').checked ? 'Cho tặng 0đ' : fmtVND($('#nl-price').value)}</h3><p class="preview-description">${esc($('#nl-desc').value)}</p><dl class="specification-list">${Object.entries(listingSpecifications()).map(([k,v]) => `<dt>${esc(document.querySelector('label[for="spec-' + k + '"]')?.textContent || k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl><p class="muted">Xem trước thông tin; tin vẫn cần admin duyệt.</p><button class="btn btn-line" onclick="closeModal()">Đóng</button>`);
}
async function previewListing(id) {
  try { const listing = await api('/seller/listings/' + id); openModal(`<h2>${esc(listing.title)}</h2><img class="preview-photo" src="${img(listing.images[0]?.url)}" alt="${esc(listing.title)}" onerror="this.src='${IMG_PH}'"><h3>${fmtVND(listing.price)}</h3><p class="preview-description">${esc(listing.description)}</p><p>${esc(listing.city)} · ${esc(listing.status)}</p><button class="btn btn-line" onclick="closeModal()">Đóng</button>`); } catch (e) { toast(e.message, 'err'); }
}
route('edit-listing', async id => {
  if (!hasRole('SELLER')) { location.hash = '#/login'; return; }
  const listing = await api('/seller/listings/' + id);
  if (['RESERVED','SOLD_OUT','DELETED'].includes(listing.status)) throw new Error('Tin này không thể chỉnh sửa');
  await routes.seller('new');
  $('#nl-title').value = listing.title; $('#nl-cat').value = listing.categoryId; $('#nl-cond').value = listing.condition;
  $('#nl-price').value = listing.price; $('#nl-free').checked = listing.isFree; $('#nl-imgs').value = listing.images.map(i => i.url).join('\n');
  $('#nl-desc').value = listing.description; $('#nl-city').value = listing.city; $('#nl-delivery').value = listing.deliveryMethod;
  await renderSpecificationFields(listing.specifications);
  if (listing.isFree && $('#nl-price')) { $('#nl-price').disabled = true; $('#nl-free').checked = true; }
  renderNlPreviews();
  const form = $('#nl-title').closest('form');
  form.querySelector('button:last-child').textContent = 'Lưu thay đổi và gửi duyệt lại';
  form.onsubmit = async event => {
    event.preventDefault();
    try { await api('/listings/' + id, { method: 'PATCH', body: { title: $('#nl-title').value, categoryId: +$('#nl-cat').value, condition: $('#nl-cond').value, price: +$('#nl-price').value, isFree: $('#nl-free').checked, images: $('#nl-imgs').value.split('\n').map(s=>s.trim()).filter(Boolean), description: $('#nl-desc').value, city: $('#nl-city').value.trim(), deliveryMethod: $('#nl-delivery').value, specifications: listingSpecifications() } }); toast('Đã lưu, tin được gửi duyệt lại', 'ok'); location.hash = '#/seller/listings'; } catch (e) { toast(e.message, 'err'); }
  };
});
function pagination(meta, action) {
  const page = meta.page, last = Math.max(1, meta.totalPages);
  return `<nav class="catalog-pagination" aria-label="Phân trang"><button class="btn btn-line btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="${action}(${page - 1})">← Trước</button><span>Trang ${page}/${last} · ${meta.total} kết quả</span><button class="btn btn-line btn-sm" ${page >= last ? 'disabled' : ''} onclick="${action}(${page + 1})">Sau →</button></nav>`;
}
function sellerListingsPage(page) { location.hash = '#/seller/listings?page=' + page; }
function sellerOrdersPage(page) { location.hash = '#/seller/orders?page=' + page; }
async function sellerOffers(page = 1) {
  const result = await api('/offers/inbox?' + new URLSearchParams({ page, limit: 10 }));
  const target = $('#seller-content') || $('#app');
  target.innerHTML = `<div class="sect"><h2>Yêu cầu trả giá</h2>${result.data.map(offer => `<div class="offer-card"><h3>${esc(offer.listing.title)}</h3><p>${esc(offer.buyer.fullName)} · Giá niêm yết ${fmtVND(offer.listing.price)} → đề nghị <b>${fmtVND(offer.offeredPrice)}</b></p><p>${esc(offer.message || '')}</p><p class="muted">${esc(offer.status)} · hết hạn ${fmtDate(offer.expiresAt)}</p>${offer.status === 'PENDING' && new Date(offer.expiresAt) > new Date() ? `<button class="btn btn-green btn-sm" onclick="offerAction(${offer.id},'ACCEPT')">Đồng ý</button> <button class="btn btn-line btn-sm" onclick="offerAction(${offer.id},'REJECT')">Từ chối</button>` : ''}</div>`).join('') || '<p class="muted">Chưa có đề nghị trả giá.</p>'}${pagination(result.meta, 'sellerOffers')}</div>`;
}
route('verify', async token => {
  const result = await api('/auth/verify-email', { method: 'POST', auth: false, body: { token } });
  $('#app').innerHTML = `<div class="empty"><h1>${esc(result.message)}</h1><a class="btn btn-green" href="#/profile">Về hồ sơ</a></div>`;
});
async function resendVerification() { try { const result = await api('/auth/resend-verification', { method: 'POST', auth: false, body: { email: store.user.email } }); toast(result.message, 'ok'); } catch (e) { toast(e.message, 'err'); } }

async function saveSearch() {
  if (!store.token) { location.hash = '#/login'; return; }
  const name = prompt('Tên tìm kiếm theo dõi:', currentQuery.q || categories.find(c => c.slug === catalogSlug())?.name || 'Đồ tôi đang tìm');
  if (!name?.trim()) return;
  const filters = { ...currentQuery }, category = categories.find(c => c.slug === catalogSlug());
  if (category) filters.categoryId = category.id;
  try { await api('/saved-searches', { method: 'POST', body: { name, filters } }); toast('Đã theo dõi. Tin mới phù hợp sẽ xuất hiện trong thông báo.', 'ok'); } catch (e) { toast(e.message, 'err'); }
}
route('saved-searches', async () => {
  if (!store.token) { location.hash = '#/login'; return; }
  const searches = await api('/saved-searches');
  $('#app').innerHTML = `<div class="wrap"><h1>🔔 Tìm kiếm đang theo dõi</h1><p class="muted">Thông báo trong ứng dụng khi tin mới được duyệt; không gửi lại cùng một tin.</p>${searches.map(search => { const { categoryId, ...query } = search.filters; const category = categories.find(c => c.id === +categoryId); return `<div class="sect"><h2>${esc(search.name)}</h2><div class="chips">${Object.entries(search.filters).map(([k,v])=>`<span class="chip">${esc(({q:"Từ khóa",categoryId:"Danh mục",condition:"Tình trạng",minPrice:"Giá từ",maxPrice:"Giá đến",city:"Địa điểm",deliveryMethod:"Giao nhận",verified:"Đã xác minh",isFree:"Cho tặng"})[k] || k)}: ${esc(k === 'categoryId' ? category?.name || v : CONDITION_NAMES[v] || ({true:"Có",false:"Không",MEETUP:"Gặp trực tiếp",DELIVERY:"Giao hàng"})[v] || v)}</span>`).join('')}</div><a class="btn btn-green btn-sm" href="${esc(catalogUrl(category?.slug, query))}">Xem kết quả</a> <button class="btn btn-line btn-sm" onclick="toggleSavedSearch(${search.id},${!search.enabled})">${search.enabled ? 'Tạm dừng thông báo' : 'Bật thông báo'}</button> <button class="btn btn-line btn-sm" onclick="deleteSavedSearch(${search.id})">Xóa</button></div>`; }).join('') || '<div class="empty">Chưa theo dõi tìm kiếm nào. Vào trang danh mục và chọn Theo dõi tìm kiếm.</div>'}</div>`;
});
async function toggleSavedSearch(id, enabled) { await api('/saved-searches/' + id, { method: 'PATCH', body: { enabled } }).then(render).catch(e=>toast(e.message,'err')); }
async function deleteSavedSearch(id) { if (confirm('Xóa tìm kiếm theo dõi này?')) await api('/saved-searches/' + id, { method: 'DELETE' }).then(render).catch(e=>toast(e.message,'err')); }

const originalListingRoute = routes.listing;
routes.listing = async id => {
  await originalListingRoute(id);
  const listing = viewedListing;
  const [history, fields] = await Promise.all([api(`/listings/${id}/price-history`, { auth: false }), api('/categories/specifications', { auth: false })]);
  const section = document.createElement('section'); section.className = 'wrap';
  section.innerHTML = `<div class="row2"><div class="sect"><h2>Hồ sơ tình trạng</h2><p class="muted">Do người bán cung cấp · ${esc(listing.city || 'Chưa ghi địa điểm')} · ${esc(({ANY:'Giao hàng hoặc gặp trực tiếp',MEETUP:'Gặp trực tiếp',DELIVERY:'Giao hàng'})[listing.deliveryMethod] || '')}</p><dl class="specification-list">${Object.entries(listing.specifications || {}).map(([k,v])=>`<dt>${esc(fields[listing.category.slug]?.[k] || k)}</dt><dd>${esc(v)}</dd>`).join('') || '<p class="muted">Người bán chưa bổ sung thông số.</p>'}</dl></div><div class="sect"><h2>Lịch sử giá</h2><p class="muted">Giá do người bán điều chỉnh; không phải giá giao dịch đã chốt.</p><canvas id="price-history-chart" height="160"></canvas><div class="history-list">${history.map(point=>`<div><span>${fmtDate(point.createdAt)}</span><b>${fmtVND(point.price)}</b></div>`).join('') || '<p>Chưa có lịch sử giá.</p>'}</div></div></div>`;
  $('#app').appendChild(section);
  if (history.length && window.Chart) { const chart = new Chart($('#price-history-chart'), { type: 'line', data: { labels: history.map(p=>fmtDate(p.createdAt)), datasets: [{ label: 'Giá niêm yết (đ)', data: history.map(p=>p.price), borderColor: '#23a336', tension: 0, fill: false }] }, options: { responsive: true, plugins: { legend: { display: false } } } }); window._charts ||= []; window._charts.push(chart); }
};
route('assistant', async () => {
  $('#app').innerHTML = `<div class="wrap"><section class="sect assistant-panel"><span class="eyebrow">TÌM MÓN ĐỒ PHÙ HỢP</span><h1>✨ Trợ lý tìm đồ</h1><p class="muted">Mô tả món đồ và ngân sách. Kết quả luôn lấy từ tin đang bán.</p><form onsubmit="askAssistant(event)"><label class="lbl" for="assistant-question">Bạn đang cần gì?</label><textarea class="input" id="assistant-question" maxlength="500" required minlength="2" placeholder="Ví dụ: laptop dưới 6 triệu tại TP. Hồ Chí Minh"></textarea><button class="btn btn-green" id="assistant-submit">Tìm sản phẩm</button></form><div id="assistant-answer" aria-live="polite"></div></section></div>`;
});
async function askAssistant(event) {
  event.preventDefault(); const button = $('#assistant-submit'); button.disabled = true;
  try { const result = await api('/assistant', { method: 'POST', auth: false, body: { message: $('#assistant-question').value } }); $('#assistant-answer').innerHTML = `<span class="badge ${result.mode === 'AI' ? 'b-green' : 'b-amber'}">${result.mode === 'AI' ? 'AI hỗ trợ bộ lọc' : 'Tìm kiếm từ khóa'}</span><p>${esc(result.message)}</p><p class="muted">${esc(result.note)}</p><div class="pgrid">${result.items.map(listingCard).join('')}</div>`; } catch (e) { toast(e.message, 'err'); } finally { button.disabled = false; }
}
async function renderReviewInsights(target) {
  const data = await api('/reviews/insights');
  target.innerHTML += `<section class="sect"><h2>Phân tích đánh giá</h2><p class="muted">Tối đa 500 đánh giá mới nhất; nhãn ước lượng không thay thế nội dung gốc.</p><div class="stat-grid">${data.sentiments.map(item=>`<div class="stat"><div class="t">${({POSITIVE:'Tích cực',NEUTRAL:'Trung lập',NEGATIVE:'Tiêu cực'})[item.sentiment]}</div><div class="v">${item.count}</div></div>`).join('')}</div><p>Điểm trung bình ${data.averageRating.toFixed(1)}/5 · ${data.sampleSize} đánh giá · ${data.sources.ai} nhãn AI, ${data.sources.local} nhãn cục bộ.</p><h3>Vấn đề thường gặp</h3>${data.issues.map(issue=>`<p>${esc(issue.name)}: <b>${issue.count}</b></p>`).join('')}</section>`;
}

const adminLists = {
  pending: { url: '/listings/admin/pending', title: 'Tin chờ duyệt', render: l => `<article class="sect"><h3>${esc(l.title)}</h3><p>${esc(l.seller?.fullName)} · ${fmtVND(l.price)}</p><p class="preview-description">${esc(l.description)}</p><div class="evidence-grid">${l.images.map(i=>`<a href="${esc(img(i.url))}" target="_blank" rel="noopener"><img src="${img(i.url)}" alt="Ảnh tin đăng" onerror="this.src='${IMG_PH}'"></a>`).join('')}</div><button class="btn btn-green btn-sm" onclick="moderate(${l.id},'APPROVE')">Duyệt</button> <button class="btn btn-line btn-sm" onclick="moderate(${l.id},'REJECT')">Từ chối</button></article>` },
  users: { url: '/admin/users', title: 'Người dùng', render: u => `<article class="sect"><h3>${esc(u.fullName)}</h3><p>${esc(u.email)} · ${esc(u.roles.map(r => ROLE_NAMES[r] || r).join(', '))} · ${esc(USER_STATUS_NAMES[u.status] || u.status)}</p><button class="btn btn-line btn-sm" onclick="userLock(${u.id},'${u.status === 'BANNED' ? 'unlock' : 'lock'}')">${u.status === 'BANNED' ? 'Mở khóa' : 'Khóa tài khoản'}</button></article>` },
  reports: { url: '/reports/admin/all', title: 'Báo cáo vi phạm', statuses: ['NEW','REVIEWING','RESOLVED','DISMISSED'], render: r => `<article class="sect"><h3>${esc(r.reason)} · ${esc(REPORT_STATUS_NAMES[r.status] || r.status)}</h3><p>${esc(r.description)}</p><p class="muted">${esc(r.reporter?.fullName)} · ${fmtDate(r.createdAt)}</p>${['NEW','REVIEWING'].includes(r.status) ? `<button class="btn btn-green btn-sm" onclick="handleReport(${r.id},'RESOLVED')">Đã xử lý</button> <button class="btn btn-line btn-sm" onclick="handleReport(${r.id},'DISMISSED')">Bỏ qua</button>` : `<p>${esc(r.resolution || '')}</p>`}</article>` },
  disputes: { url: '/disputes/admin/all', title: 'Tranh chấp', statuses: ['OPEN','REVIEWING','CLOSED','REFUNDED','REJECTED'], render: x => `<article class="sect"><h3>${esc(x.code)} · Đơn ${esc(x.order.code)}</h3><p><b>${esc(x.reason)}</b> · ${esc(DISPUTE_STATUS_NAMES[x.status] || x.status)}</p><p class="preview-description">${esc(x.description)}</p><p class="muted">Người mua: ${esc(x.buyer?.fullName)} · Người bán: ${esc(x.seller?.fullName)}</p><div class="evidence-grid">${x.evidences.map(e=>evidencePicture(e.url)).join('') || '<p class="muted">Chưa có ảnh bằng chứng.</p>'}</div>${['OPEN','REVIEWING'].includes(x.status) ? `<button class="btn btn-green btn-sm" onclick="resolveDispute(${x.id},'BUYER_WINS')">Hoàn tiền người mua</button> <button class="btn btn-dark btn-sm" onclick="resolveDispute(${x.id},'SELLER_WINS')">Giải ngân người bán</button> <button class="btn btn-line btn-sm" onclick="resolveDispute(${x.id},'SPLIT')">Chia đôi</button> <button class="btn btn-line btn-sm" onclick="resolveDispute(${x.id},'REJECT')">Bác khiếu nại</button>` : `<p>${esc(x.resolution || '')}</p>`}</article>` },
  transactions: { url: '/admin/finance/transactions', title: 'Giao dịch ví', render: t => `<article class="sect"><b>#${t.id} · ${esc(TXN_TYPE_NAMES[t.type] || t.type)} · ${fmtVND(t.amount)}</b><p>${esc(t.reference || '')} · ${esc(t.note || '')}</p><p class="muted">${fmtDate(t.createdAt)}</p></article>` },
  audit: { url: '/admin/audit', title: 'Nhật ký quản trị', render: e => `<article class="sect"><h3>${esc(AUDIT_ACTIONS[e.action] || e.action)} · ${esc(e.target)}</h3><p>${esc(e.admin?.fullName)} · ${fmtDate(e.createdAt)}</p>${formatAuditDetail(e.detail)}</article>` },
};
let adminListKey;
async function openAdminList(key) {
  adminListKey = key;
  const config = adminLists[key];
  $('#abody').innerHTML = `<h2>${esc(config.title)}</h2><form class="toolbar" onsubmit="event.preventDefault();adminListPage()"><label class="lbl" for="admin-search">Tìm kiếm</label><input class="input" id="admin-search" maxlength="150" placeholder="Nhập từ khóa">${config.statuses ? `<select class="input" id="admin-list-status" aria-label="Trạng thái"><option value="">Tất cả trạng thái</option>${config.statuses.map(s=>`<option value="${s}">${esc(lbl({ ...REPORT_STATUS_NAMES, ...DISPUTE_STATUS_NAMES, ...LISTING_STATUS_NAMES, ...USER_STATUS_NAMES, ...ESCROW_STATUS_NAMES, ...(typeof WORKFLOW_LABELS !== 'undefined' ? WORKFLOW_LABELS : {}) }, s))}</option>`).join('')}</select>` : ''}<button class="btn btn-green">Tìm</button></form><div id="admin-results" aria-live="polite"></div>`;
  await adminListPage();
}
async function adminListPage(page = 1) {
  const target = $('#admin-results'), config = adminLists[adminListKey];
  const query = new URLSearchParams({ page, limit: 10, q: $('#admin-search').value.trim() });
  const status = $('#admin-list-status')?.value;
  if (status) query.set('status', status);
  try { const result = await api(config.url + '?' + query); target.innerHTML = result.data.map(config.render).join('') || '<div class="empty">Không có kết quả phù hợp.</div>'; target.innerHTML += pagination(result.meta, 'adminListPage'); }
  catch(e) { target.innerHTML = `<p role="alert">${esc(e.message)}</p>`; }
}
for (const [role, keys] of Object.entries({ content: ['pending','users','reports','audit'], finance: ['disputes','transactions','audit'] })) {
  for (const key of keys) ADMIN_VIEWS[`${role}:${key}`] = () => openAdminList(key);
  ADMIN_TABS[role].push(['audit','📋 Nhật ký quản trị'], ['insights','⭐ Phân tích đánh giá']);
  ADMIN_VIEWS[`${role}:insights`] = async () => { $('#abody').innerHTML = ''; await renderReviewInsights($('#abody')); };
}
