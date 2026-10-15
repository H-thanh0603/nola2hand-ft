/* Nola2Hand Frontend — SPA vanilla JS nối API backend */
const API = '/api/v1'; // cùng origin khi serve từ backend
// Đăng nhập Google: điền Client ID lấy tại https://console.cloud.google.com/apis/credentials
// (Web application, Authorized JavaScript origins thêm http://localhost:4000)
let GOOGLE_CLIENT_ID = '';
const IMG_PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#e8f0e9"/><text x="200" y="150" font-size="44" text-anchor="middle" fill="#9db3a1">📦</text><text x="200" y="185" font-size="14" text-anchor="middle" fill="#9db3a1">Nola2Hand</text></svg>`);

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtVND = (n) => (n == null ? '—' : Number(n).toLocaleString('vi-VN') + ' đ');
const fmtDate = (d) => d ? new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const img = (u) => esc(u || IMG_PH);
const store = {
  get token() { return localStorage.getItem('nola_token'); },
  set token(v) { v ? localStorage.setItem('nola_token', v) : localStorage.removeItem('nola_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('nola_user')); } catch { return null; } },
  set user(v) { v ? localStorage.setItem('nola_user', JSON.stringify(v)) : localStorage.removeItem('nola_user'); },
};
const hasRole = (...rs) => (store.user?.roles || []).some((r) => rs.includes(r));

function uiIcon(name) {
  const paths = {
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    heart:'<path d="M20.8 5.8a5.4 5.4 0 0 0-7.6 0L12 7l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z"/>',
    chat:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z"/><path d="M7 11h10M7 15h6"/>',
    cart:'<path d="M2 3h3l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/>',
    user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
    home:'<path d="m3 10 9-8 9 8v11h-6v-7H9v7H3Z"/>',
    shop:'<path d="M3 9V4h18v5l-2 4-4-2-3 2-3-2-4 2ZM4 13v8h16v-8M9 21v-5h6v5"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    cycle:'<path d="m17 3 4 4-4 4M21 7H9a6 6 0 0 0-6 6m4 8-4-4 4-4m-4 4h12a6 6 0 0 0 6-6"/>',
    pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    box:'<path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M3 7l9 5v10M7.5 4.5l9 5v4"/>',
    wallet:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9V5l14-3v3M16 12h5v5h-5Z"/>',
    chart:'<path d="M4 3v18h18M8 16v-5m5 5V7m5 9V4"/>',
    orders:'<path d="M6 3h12v19l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h4"/>',
    return:'<path d="m7 3-5 5 5 5M2 8h12a7 7 0 0 1 0 14H8"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    compare:'<path d="M8 3v18M16 3v18M3 8h10m-4-4 4 4-4 4m12 4H11m4-4-4 4 4 4"/>',
    star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
    phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4M10 5h4"/>',
    sofa:'<path d="M5 10V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M5 10a3 3 0 0 0-3 3v6h20v-6a3 3 0 0 0-6 0v2H8v-2a3 3 0 0 0-3-3ZM5 19v3m14-3v3"/>',
    kitchen:'<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M6 2v3m12-3v3M6 8h1"/>',
    shirt:'<path d="m8 3-6 4 3 5 3-2v12h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"/>',
    bike:'<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-9 5 9H5m5-9h6l3 9M8 5h4m3-1h3l1 4"/>',
    gift:'<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v9h14v-9M12 8v14M12 8C3 9 5-1 10 3l2 5c9 1 7-9 2-5Z"/>',
    filter:'<path d="M3 6h18M6 12h12M9 18h6"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}
function categoryIcon(slug) { return uiIcon(({'dien-tu-cu':'phone','noi-that':'sofa','do-gia-dung':'kitchen','thoi-trang-2hand':'shirt','xe-co':'bike','cho-tang-0d':'gift'})[slug] || 'box'); }
function cleanLabel(text) { return text.replace(/^[\s\p{Extended_Pictographic}\uFE0F＋]+/u, ''); }
function navigationIcon(key) {
  return ({dashboard:'grid',overview:'grid',charts:'chart',listings:'box',pending:'box',new:'plus',offers:'chat',insights:'star',orders:'orders',transactions:'wallet',withdrawals:'wallet',disputes:'shield',fees:'chart',audit:'orders',reviews:'star',reports:'shield',promos:'gift',banners:'grid',users:'user',permissions:'shield',returns:'return'})[key] || 'grid';
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && store.token) headers['Authorization'] = 'Bearer ' + store.token;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const error = new Error(data.message || ('Lỗi ' + res.status)); error.status = res.status; throw error; }
  return data;
}

function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  $('#toast-root').innerHTML = '';
  $('#toast-root').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
let modalTrigger;
function openModal(html) {
  if (!$('#modal-root .modal')) modalTrigger = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal" role="dialog" aria-modal="true" aria-label="Hộp thoại Nola2Hand" tabindex="-1"><button type="button" class="modal-close" aria-label="Đóng hộp thoại" onclick="closeModal()">×</button>${html}</div></div>`;
  const modal=$('#modal-root .modal');
  const title=modal?.querySelector('h2,h3');
  if(title)title.textContent=cleanLabel(title.textContent);
  if(title)modal.setAttribute('aria-label',title.textContent);
  decorateActionIcons(modal); labelFields(modal);
  (modal?.querySelector('input:not([type=hidden]),textarea,select')||modal)?.focus();
}
function closeModal() { $('#modal-root').innerHTML = ''; if(modalTrigger?.isConnected)modalTrigger.focus();modalTrigger=null; }
document.addEventListener?.('keydown',event=>{
  const modal=$('#modal-root .modal');if(!modal)return;
  if(event.key==='Escape'){event.preventDefault();closeModal();return;}
  if(event.key!=='Tab')return;
  const focusable=[...modal.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
  const first=focusable[0],last=focusable.at(-1);
  if(!first){event.preventDefault();modal.focus();return;}
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===modal)){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===modal)){event.preventDefault();first.focus();}
});

function avatarHtml(user, size = 32) {
  if (user?.avatarUrl) return `<img src="${img(user.avatarUrl)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover">`;
  const ch = (user?.fullName || '?').trim().charAt(0).toUpperCase();
  return `<span style="width:${size}px;height:${size}px;border-radius:50%;background:var(--green);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:${size * 0.45}px;flex-shrink:0">${esc(ch)}</span>`;
}

const ORDER_ST = {
  PENDING_DEPOSIT: ['Chờ đặt cọc', 'p-warn'], DEPOSITED: ['Đã cọc', 'p-info'],
  CONFIRMED: ['Đã xác nhận', 'p-info'], SHIPPING: ['Đang giao', 'p-info'],
  DELIVERED: ['Đã giao', 'p-ok'], COMPLETED: ['Hoàn tất', 'p-ok'],
  CANCELLED: ['Đã huỷ', 'p-mut'], DISPUTED: ['Tranh chấp', 'p-bad'], REFUNDED: ['Đã hoàn tiền', 'p-mut'],
};
const stPill = (s) => { const [t, c] = ORDER_ST[s] || [s, 'p-mut']; return `<span class="pill ${c}">${t}</span>`; };
// Tên hiển thị cho enum + chi tiết nhật ký audit (tránh hiện JSON/enum thô).
const ROLE_NAMES = { BUYER: 'Người mua', SELLER: 'Người bán', ADMIN_FINANCE: 'Admin tài chính', ADMIN_CONTENT: 'Admin nội dung' };
const USER_STATUS_NAMES = { ACTIVE: 'Đang hoạt động', BANNED: 'Đã khóa', PENDING_VERIFICATION: 'Chờ xác minh' };
const OFFER_ST = { PENDING: ['Chờ phản hồi', 'p-warn'], ACCEPTED: ['Đã đồng ý', 'p-ok'], REJECTED: ['Từ chối', 'p-bad'], CANCELLED: ['Đã hủy', 'p-mut'], EXPIRED: ['Hết hạn', 'p-mut'] };
const LISTING_STATUS_NAMES = { DRAFT: 'Nháp', PENDING_REVIEW: 'Chờ duyệt', ACTIVE: 'Đang bán', RESERVED: 'Đang giữ', HIDDEN: 'Đang ẩn', SOLD_OUT: 'Đã bán', REJECTED: 'Bị từ chối', DELETED: 'Đã xóa' };
const ESCROW_STATUS_NAMES = { HELD: 'Đang giữ hộ', RELEASED: 'Đã giải ngân', REFUNDED: 'Đã hoàn', CANCELLED: 'Đã hủy' };
const TXN_TYPE_NAMES = { TOPUP: 'Nạp tiền', WITHDRAW: 'Rút tiền', ORDER_INCOME: 'Thu bán hàng', ORDER_PAYMENT: 'Thanh toán đơn', PLATFORM_FEE: 'Phí sàn', REFUND: 'Hoàn tiền', ADJUSTMENT: 'Điều chỉnh' };
const DISPUTE_STATUS_NAMES = { OPEN: 'Mới mở', REVIEWING: 'Đang xem xét', REFUNDED: 'Đã hoàn tiền', REJECTED: 'Đã bác', CLOSED: 'Đã đóng' };
const DISPUTE_DECISIONS = { BUYER_WINS: 'Người mua thắng', SELLER_WINS: 'Người bán thắng', SPLIT: 'Chia đôi', REJECT: 'Bác khiếu nại' };
const REPORT_STATUS_NAMES = { NEW: 'Mới', REVIEWING: 'Đang xem xét', RESOLVED: 'Đã xử lý', DISMISSED: 'Bỏ qua' };
const AUDIT_ACTIONS = { RETURN_APPROVE: 'Duyệt trả hàng', RETURN_REJECT: 'Từ chối trả hàng', RETURN_CANCEL: 'Hủy trả hàng', RETURN_SHIP: 'Buyer gửi trả', RETURN_RECEIVE: 'Đã nhận hàng trả', RETURN_REFUND: 'Hoàn tiền trả hàng', RETURN_COD_REFUND: 'Ghi nhận hoàn COD', RETURN_COD_CONFIRM: 'Buyer xác nhận COD', CREATE_FEE: 'Tạo phí', UPDATE_FEE: 'Sửa phí', DELETE_FEE: 'Xóa phí', LOCK_USER: 'Khóa tài khoản', UNLOCK_USER: 'Mở khóa', VERIFY_USER: 'Duyệt xác minh', SET_ROLES: 'Đổi vai trò', MODERATE_LISTING: 'Duyệt tin', RESOLVE_DISPUTE: 'Xử lý tranh chấp', WITHDRAW_APPROVE: 'Duyệt rút tiền', WITHDRAW_PAY: 'Đã chuyển khoản', WITHDRAW_REJECT: 'Từ chối rút tiền', WITHDRAW_FAIL: 'Chuyển thất bại' };
const FEE_KIND_NAMES = { PLATFORM_TXN: 'Phí giao dịch', WITHDRAW: 'Phí rút tiền', PENALTY: 'Phí phạt' };
const PROMO_STATUS_NAMES = { DRAFT: 'Nháp', ACTIVE: 'Đang chạy', PAUSED: 'Tạm dừng', ENDED: 'Kết thúc' };
const lbl = (map, v) => (v != null && map[v]) || v || '—';
// shortcut: audit detail có nhiều hình dạng; chỉ format các key đã biết, còn lại liệt kê text thuần.
function formatAuditDetail(d) {
  d = d || {};
  const rows = [];
  if (d.refundAmount != null) rows.push(['Hoàn vào ví', fmtVND(d.refundAmount)]);
  if (d.codAmount) rows.push(['COD hoàn ngoài ví', fmtVND(d.codAmount)]);
  if (d.amount != null) rows.push(['Số tiền', fmtVND(d.amount)]);
  if (d.fee != null) rows.push(['Phí', fmtVND(d.fee)]);
  if (d.decision) rows.push(['Quyết định', esc(DISPUTE_DECISIONS[d.decision] || d.decision)]);
  if (d.action) rows.push(['Hành động', esc({ APPROVE: 'Đã duyệt', REJECT: 'Từ chối', DELETE: 'Đã xóa' }[d.action] || d.action)]);
  if (d.roles) rows.push(['Vai trò', esc(d.roles.map(r => ROLE_NAMES[r] || r).join(', '))]);
  if (d.reportId != null) rows.push(['Báo cáo', esc('#' + d.reportId)]);
  if (d.resolution) rows.push(['Ghi chú xử lý', esc(d.resolution)]);
  if (d.transferReference) rows.push(['Chứng từ', esc(d.transferReference)]);
  if (d.reason) rows.push(['Lý do', esc(d.reason)]);
  if (d.note) rows.push(['Ghi chú', esc(d.note)]);
  return rows.length ? `<dl class="audit-list">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '<p class="muted">Không có chi tiết.</p>';
}

/* ---------- header / footer ---------- */
let categories = [];
async function loadCategories() {
  try { categories = await api('/categories', { auth: false }); } catch { categories = []; }
  renderCatNav();
}
function renderHeader() {
  const u = store.user;
  $('#topbar').innerHTML = `<div>Mỗi món đồ, thêm một hành trình.</div><div><a href="#/orders">Đơn mua</a><a href="#/returns">Trả hàng</a><a href="#/seller">Kênh người bán</a>${hasRole('ADMIN_FINANCE','ADMIN_CONTENT')?'<a href="#/admin">Quản trị</a>':''}${u ? '' : '<a href="#/register">Đăng ký</a>'}</div>`;
  $('#site-header').innerHTML = `
    <a class="logo" href="#/" aria-label="Nola2Hand — Trang chủ"><span class="brand-mark">${uiIcon('cycle')}</span><span><span class="g">nola</span>2hand<span class="logo-caption">Đồ cũ. Giá trị mới.</span></span></a>
    <div class="searchbar"><label class="sr-only" for="search-category">Danh mục tìm kiếm</label><select id="search-category"><option value="">Tất cả danh mục</option>${categories.map(c => `<option value="${esc(c.slug)}" ${catalogSlug() === c.slug ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><input id="q" aria-label="Từ khóa tìm kiếm" placeholder="Tìm món đồ bạn đang cần..." value="${esc(currentQuery.q || '')}"><button onclick="doSearch()" aria-label="Tìm kiếm">${uiIcon('search')}<span>Tìm kiếm</span></button></div>
    <div class="header-actions">
      <a class="hact" href="#/notifications" aria-label="Thông báo">${uiIcon('bell')}<span class="dot" id="notif-dot" style="display:none"></span></a>
      <a class="hact desktop-action" href="#/favorites" aria-label="Tin đã lưu">${uiIcon('heart')}</a>
      <a class="hact desktop-action" href="#/chat" aria-label="Tin nhắn">${uiIcon('chat')}</a>
      <a class="hact" href="#/cart" aria-label="Giỏ hàng">${uiIcon('cart')}<span class="dot" id="cart-dot" style="display:none"></span></a>
      ${u ? `<div class="u-menu"><button type="button" class="u-chip" aria-haspopup="true" aria-expanded="false" aria-label="Tài khoản của tôi" onclick="toggleUserMenu(event)">${avatarHtml(u)}<span>${esc(u.fullName.split(' ').slice(-2).join(' '))}</span><span aria-hidden="true">▾</span></button><div class="u-dropdown" hidden><p class="u-dropdown-head"><b>${esc(u.fullName)}</b><span>${esc(u.email)}</span></p><a href="#/profile">👤 Hồ sơ cá nhân</a><a href="#/orders">📦 Đơn mua</a><a href="#/wallet">💰 Ví SafePay</a><a href="#/chat">💬 Tin nhắn</a><a href="#/notifications">🔔 Thông báo</a><a href="#/favorites">🤍 Tin đã lưu</a><a href="#/seller">🏪 Kênh người bán</a>${hasRole('ADMIN_FINANCE','ADMIN_CONTENT')?'<a href="#/admin">🛠️ Trang quản trị</a>':''}<button type="button" class="u-logout" onclick="logout()">↪ Đăng xuất</button></div></div>` : '<a class="btn btn-line btn-sm login-link" href="#/login">Đăng nhập</a>'}
    </div>`;
  const qi = $('#q');
  if (qi) qi.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  bindSearchSuggest();
  renderCatNav(); renderMobileNav(); updateNotifDot(); updateCartDot();
}
function renderCatNav() {
  $('#catnav').innerHTML = `<a href="#/" class="${location.hash === '#/' ? 'on' : ''}">${uiIcon('grid')} Khám phá</a>` + (categories || []).slice(0, 6).map(c =>
    `<a href="${esc(catalogUrl(c.slug))}" ${catalogSlug() === c.slug ? 'class="on" aria-current="page"' : ''}>${esc(c.name)}</a>`).join('')
    + `<a href="#/shops" class="nav-extra">${uiIcon('shop')} Gian hàng</a><a href="#/assistant" class="nav-extra">${uiIcon('search')} Trợ lý tìm đồ</a><a class="nav-sell" href="#/seller">${uiIcon('plus')} Đăng tin</a>`;
}
function renderMobileNav() {
  const target = $('#mobile-nav');
  if (!target) return;
  const current = location.hash.slice(2).split(/[/?]/)[0] || '';
  target.innerHTML = [['','home','Khám phá'],['favorites','heart','Đã lưu'],['chat','chat','Tin nhắn'],['orders','orders','Đơn mua'],[store.user?'profile':'login','user','Tài khoản']].map(([path,icon,label]) => `<a href="#/${path}" ${current===path?'aria-current="page"':''}>${uiIcon(icon)}<span>${label}</span></a>`).join('');
}
function renderFooter() {
  $('#site-footer').innerHTML = `
    <div class="foot-main">
      <div><a class="logo" href="#/"><span class="brand-mark">${uiIcon('cycle')}</span><span><span class="g">nola</span>2hand</span></a><p>Một món đồ còn tốt.<br>Một lựa chọn đáng giá.</p><span class="footer-note">Mua bán đồ đã qua sử dụng cùng Nola2Hand.</span></div>
      <div><h4>Khám phá</h4>${categories.slice(0,4).map(c=>`<a href="${esc(catalogUrl(c.slug))}">${esc(c.name)}</a>`).join('')}<a href="#/shops">Các gian hàng</a></div>
      <div><h4>Mua sắm cùng Nola</h4><a href="#/favorites">Tin đã lưu</a><a href="#/compare">So sánh sản phẩm</a><a href="#/saved-searches">Theo dõi tìm kiếm</a><a href="#/assistant">Trợ lý tìm đồ</a><a href="#/returns">Trả hàng và hoàn tiền</a></div>
      <div><h4>Tài khoản của bạn</h4>${store.user?'<a href="#/profile">Hồ sơ cá nhân</a><a href="#/orders">Đơn mua</a><a href="#/wallet">Ví SafePay</a><a href="#/chat">Tin nhắn</a>':'<a href="#/login">Đăng nhập</a><a href="#/register">Tạo tài khoản</a>'}<a href="#/seller">Kênh người bán</a>${hasRole('ADMIN_FINANCE','ADMIN_CONTENT')?'<a href="#/admin">Trang quản trị</a>':''}</div>
    </div>
    <div class="foot-copy"><span>© 2026 Nola2Hand</span><span>Trao cơ hội mới cho những món đồ còn tốt.</span></div>`;
}
async function updateNotifDot() {
  if (!store.token) return;
  try {
    const d = await api('/notifications?unread=true&limit=1');
    const dot = $('#notif-dot');
    if (dot) dot.style.display = d.meta.total > 0 ? 'flex' : 'none';
  } catch { /* ignore */ }
}
function catalogSlug() { return location.hash.slice(2).split('?')[0].split('/')[0] === 'category' ? location.hash.slice(2).split('?')[0].split('/')[1] : ''; }
function catalogUrl(slug = '', query = {}) {
  const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null));
  return (slug ? '#/category/' + encodeURIComponent(slug) : '#/') + (params.size ? '?' + params.toString() : '');
}
function doSearch() {
  const box = document.querySelector('.search-suggest'), go = box && !box.hidden ? +box.dataset.hi : -1;
  if (go >= 0 && box.children[go]) { box.children[go].dispatchEvent(new Event('mousedown')); return; }
  location.hash = catalogUrl($('#search-category').value, { q: $('#q').value.trim() }); closeSearchSuggest();
}
function closeSearchSuggest() { (document.querySelectorAll?.('.search-suggest') || []).forEach(b => b.remove()); }
function bindSearchSuggest() {
  closeSearchSuggest();
  const qi = $('#q');
  if (!qi || typeof document.createElement !== 'function' || !document.body || typeof window.addEventListener !== 'function') return;
  const box = document.createElement('div'); box.className = 'search-suggest'; box.hidden = true; document.body.appendChild(box);
  let items = [], hi = -1, timer;
  const place = () => { const r = qi.getBoundingClientRect(); box.style.top = (r.bottom + 6) + 'px'; box.style.left = r.left + 'px'; box.style.width = r.width + 'px'; };
  const paint = () => {
    const q = qi.value.trim();
    box.dataset.hi = hi;
    box.innerHTML = items.map((l, i) => `<button type="button" data-i="${i}" class="${i === hi ? 'on' : ''}"><img src="${img(l.images?.[0]?.url)}" alt="" onerror="this.src='${IMG_PH}'"><span><b>${esc(l.title)}</b><span>${l.isFree ? 'Cho tặng 0đ' : fmtVND(l.price)}</span></span></button>`).join('')
      + (q ? `<button type="button" data-all="1">🔍 Xem tất cả kết quả cho “${esc(q)}”</button>` : '');
    box.hidden = !q;
  };
  box.addEventListener('mousedown', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    e.preventDefault();
    location.hash = b.dataset.all ? catalogUrl($('#search-category')?.value, { q: qi.value.trim() }) : '#/listing/' + items[+b.dataset.i].id;
    closeSearchSuggest();
  });
  box.addEventListener('mousemove', (e) => { const b = e.target.closest('button'); if (!b) return; hi = [...box.children].indexOf(b); paint(); });
  qi.addEventListener('input', () => {
    clearTimeout(timer); hi = -1;
    const q = qi.value.trim();
    if (q.length < 2) { box.hidden = true; return; }
    timer = setTimeout(async () => {
      try {
        const r = await api('/listings?' + new URLSearchParams({ q, limit: 6 }), { auth: false });
        if (document.activeElement !== qi) return;
        items = r.data || []; place(); paint();
      } catch { box.hidden = true; }
    }, 300);
  });
  qi.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    const n = items.length + 1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hi = (hi + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; paint(); }
    // Enter do handler doSearch xử lý (đọc box.dataset.hi), tránh chạy 2 lần.
    else if (e.key === 'Escape') box.hidden = true;
  });
  qi.addEventListener('blur', () => setTimeout(closeSearchSuggest, 150));
  window.addEventListener('scroll', closeSearchSuggest, { passive: true });
}
function goCat(id) { const category = categories.find(c => c.id === +id); if (category) location.hash = catalogUrl(category.slug); }
async function becomeSeller() {
  if (hasRole('SELLER')) { location.hash = '#/seller'; return; }
  openModal(`<h2>🏪 Mở gian hàng</h2><p class="muted">Bước 1/2 — Biết trước khi bán</p>
    <div class="stat-grid"><div class="stat"><div class="t">Đăng tin</div><div class="v">Miễn phí</div></div><div class="stat"><div class="t">Phí sàn</div><div class="v">Khi bán được</div></div><div class="stat"><div class="t">Tiền về</div><div class="v">Ví SafePay</div></div></div>
    <div class="sect" style="margin:12px 0"><p>💰 Phí sàn chỉ thu khi bán được hàng, theo từng danh mục.</p><p>🔒 Tiền cọc được giữ hộ tới khi người mua xác nhận nhận hàng.</p><p>⚠️ Tin vi phạm bị ẩn, tái phạm bị khóa shop.</p></div>
    <label class="free-filter"><input id="seller-agree" type="checkbox"> Tôi đã đọc và đồng ý quy định bán hàng</label>
    <button class="btn btn-green" style="width:100%;margin-top:12px" onclick="sellerWizardInfo()">Tiếp tục →</button>`);
}
function sellerWizardInfo() {
  if (!$('#seller-agree')?.checked) { toast('Bạn cần đồng ý quy định bán hàng', 'err'); return; }
  openModal(`<h2>🏪 Thông tin shop</h2><p class="muted">Bước 2/2 — Buyer tin shop có tên rõ ràng, SĐT và địa chỉ lấy hàng.</p>
    <form onsubmit="return sellerWizardSubmit(event)"><div class="form-row"><label class="lbl" for="seller-shop">Tên shop *</label><input class="input" id="seller-shop" required minlength="2" maxlength="100" value="${esc('Shop ' + (store.user?.fullName || ''))}"></div>
    <div class="form-row"><label class="lbl" for="seller-phone">SĐT liên hệ (VD: 0987654321)</label><input class="input" id="seller-phone" inputmode="tel" maxlength="20" pattern="(\+84|0)(3|5|7|8|9)[0-9]{8}" value="${esc(store.user?.phone || '')}" placeholder="Để buyer và shipper liên lạc"></div>
    <div class="form-row"><label class="lbl" for="seller-city">Tỉnh / thành phố</label><input class="input" id="seller-city" maxlength="100" placeholder="VD: TP. Hồ Chí Minh"></div>
    <div class="form-row"><label class="lbl" for="seller-street">Địa chỉ lấy hàng</label><input class="input" id="seller-street" maxlength="255" placeholder="Số nhà, đường..."></div>
    <button class="btn btn-green" style="width:100%">Mở gian hàng</button></form>`);
}
async function sellerWizardSubmit(e) {
  e.preventDefault();
  const body = { shopName: $('#seller-shop').value.trim(), phone: $('#seller-phone').value.trim() || undefined, city: $('#seller-city').value.trim() || undefined, street: $('#seller-street').value.trim() || undefined };
  if (body.shopName.length < 2) { toast('Tên shop tối thiểu 2 ký tự', 'err'); return false; }
  if ((body.city && !body.street) || (!body.city && body.street)) { toast('Nhập đủ tỉnh/thành và địa chỉ, hoặc bỏ trống cả hai', 'err'); return false; }
  try {
    await api('/users/me/become-seller', { method: 'POST', body });
    const me = await api('/auth/me');
    store.user = { ...store.user, roles: me.roles, phone: me.phone };
    openModal(`<h2>🎉 Gian hàng đã mở!</h2><p class="muted">${esc(body.shopName)} sẵn sàng đón khách. Vào Hồ sơ để xác minh email/danh tính lấy huy hiệu ✓, buyer sẽ tin shop hơn.</p>
      <button class="btn btn-green" style="width:100%" onclick="closeModal();location.hash='#/seller/new'">＋ Đăng tin đầu tiên</button>
      <button class="btn btn-line" style="width:100%;margin-top:8px" onclick="closeModal();location.hash='#/seller'">Về kênh người bán</button>`);
    toast('Mở kênh người bán thành công!', 'ok');
    renderHeader(); renderFooter();
  } catch (err) { toast(err.message, 'err'); }
  return false;
}
async function logout() { try { if (store.token) await api('/auth/logout', {method:'POST'}); } catch(e) { if(e.status!==401) { toast('Chưa thể thu hồi phiên trên máy chủ: '+e.message,'err'); return; } } clearSession(); }
function clearSession() { store.token=null; store.user=null; window._banks=[]; renderHeader(); renderFooter(); location.hash='#/login'; }
function toggleUserMenu(e) {
  e.stopPropagation();
  const menu = e.currentTarget.closest('.u-menu'), panel = menu.querySelector('.u-dropdown');
  const open = panel.hidden;
  panel.hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', String(open));
  if (open) {
    const close = (ev) => { if (!menu.contains(ev.target)) { panel.hidden = true; menu.querySelector('.u-chip').setAttribute('aria-expanded', 'false'); document.removeEventListener('click', close); } };
    document.addEventListener('click', close);
  }
}
document.addEventListener?.('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.u-dropdown').forEach(p => { p.hidden = true; }); });

/* ---------- router ---------- */
let currentQuery = {};
const routes = {};
function route(path, fn) { routes[path] = fn; }
let renderRunning = false, pendingRender = false;
async function render() {
  // Nối tiếp hoá render: hash đổi liên tục thì render cũ xong sẽ render lại hash mới nhất,
  // tránh render cũ (chậm hơn) ghi đè nhầm nội dung của render mới.
  if (renderRunning) { pendingRender = true; return; }
  renderRunning = true;
  try {
    do {
      pendingRender = false;
      await renderOnce();
    } while (pendingRender);
  } finally { renderRunning = false; }
}
async function renderOnce() {
  killCharts();
  (window._evidenceUrls||[]).forEach(url=>URL.revokeObjectURL(url));window._evidenceUrls=[];
  const [hash, search = ''] = (location.hash.slice(2) || '').split('?');
  const [name, param] = hash.split('/');
  if (!name || name === 'category') {
    const params = new URLSearchParams(search);
    currentQuery = Object.fromEntries(['q', 'condition', 'minPrice', 'maxPrice', 'sort', 'isFree', 'page', 'city', 'deliveryMethod', 'verified'].filter(k => params.has(k)).map(k => [k, params.get(k)]));
  }
  document.body.classList.toggle('admin-mode', name === 'admin' && hasRole('ADMIN_FINANCE', 'ADMIN_CONTENT'));
  if (document.body.dataset) document.body.dataset.page = name || 'home';
  document.title = 'Nola2Hand — Sàn đồ cũ';
  renderHeader();
  const fn = routes[name] || routes[''];
  $('#app').innerHTML = '<div class="loading-state" role="status"><span class="loading-spinner" aria-hidden="true"></span><span>Đang tải nội dung...</span></div>';
  window.scrollTo(0, 0);
  try {
    await fn(param);
    finishView(name);
    if (!name || name === 'category') window.requestAnimationFrame?.(() => window.scrollTo(0, catalogScroll.get(location.hash) || 0));
  }
  catch (e) {
    if (e.message.includes('đăng nhập') || e.message.includes('Token'))
      $('#app').innerHTML = `<div class="empty"><div class="e">🔒</div><p>${esc(e.message)}</p><br><a class="btn btn-green" href="#/login">Đăng nhập</a></div>`;
    else $('#app').innerHTML = `<div class="empty"><div class="e">⚠️</div><p>${esc(e.message)}</p><br><button class="btn btn-line" onclick="history.back()">Quay lại</button></div>`;
  }
}
const catalogScroll = new Map();
window.addEventListener('hashchange', event => {
  const previous = new URL(event.oldURL).hash;
  if (previous === '#/' || previous.startsWith('#/?') || previous.startsWith('#/category/')) catalogScroll.set(previous, window.scrollY);
  closeModal(); render();
});
function listingCard(l) {
  const thumb = l.images?.[0]?.url || (l.images && l.images[0]) || null;
  return `<article class="pcard">
    <a class="product-image" href="#/listing/${l.id}" aria-label="${esc(l.title)}"><img class="ph" src="${img(thumb)}" alt="${esc(l.title)}" loading="lazy" onerror="this.src='${IMG_PH}'"></a>
    <button class="fav" onclick="event.stopPropagation();toggleFav(${l.id},this)" aria-label="Lưu tin ${esc(l.title)}" title="Lưu tin">${uiIcon('heart')}</button>
    <div class="pb"><div class="product-category">${esc(l.category?.name || 'Đồ đã qua sử dụng')}</div>
      <a class="product-title" href="#/listing/${l.id}">${esc(l.title)}</a>
      <div class="product-price">${l.isFree ? 'Cho tặng 0đ' : fmtVND(l.price)}</div>
      ${CONDITION_NAMES[l.condition] ? `<span class="badge b-gray"><span class="condition-dot"></span>${CONDITION_NAMES[l.condition]}</span>` : ''}
      <div class="product-meta muted"><span>${uiIcon('pin')}${esc(l.city || 'Liên hệ người bán')}</span><span>${uiIcon('eye')}${l.views || 0}</span></div>
    </div></article>`;
}
async function toggleFav(id, btn) {
  if (!store.token) { location.hash = '#/login'; return; }
  try {
    const r = await api(`/listings/${id}/favorite`, { method: 'POST' });
btn.innerHTML = uiIcon('heart'); btn.classList.toggle('is-saved',r.favorited); btn.setAttribute('aria-pressed',String(r.favorited));
    toast(r.favorited ? 'Đã lưu tin 🤍' : 'Đã bỏ lưu', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

/* ================= BUYER VIEWS ================= */
const CATEGORY_DESIGNS = {
  'dien-tu-cu': { theme: 'tech', title: 'Công nghệ hay. Giá vừa tay.', description: 'Khám phá điện thoại, laptop và thiết bị công nghệ đã qua sử dụng. So sánh tình trạng, chọn đúng món bạn cần.', topics: ['Điện thoại', 'Laptop', 'Tai nghe', 'Bàn phím'] },
  'noi-that': { theme: 'living', title: 'Thêm chất riêng cho tổ ấm.', description: 'Bàn ghế, sofa và đồ nội thất có cơ hội về nhà mới. Làm mới không gian với những lựa chọn tiết kiệm hơn.', topics: ['Sofa', 'Bàn', 'Ghế', 'Tủ'] },
  'do-gia-dung': { theme: 'kitchen', title: 'Đồ hữu ích. Nhà thêm tiện.', description: 'Tìm đồ dùng nhà bếp và thiết bị gia đình phù hợp với nhu cầu hằng ngày, từ người bán trên Nola2Hand.', topics: ['Bếp', 'Nồi', 'Quạt', 'Máy giặt'] },
  'thoi-trang-2hand': { theme: 'living', title: 'Phong cách mới, lựa chọn bền vững.', description: 'Khám phá quần áo, giày dép và phụ kiện 2Hand để làm mới phong cách của bạn.', topics: ['Áo', 'Quần', 'Giày', 'Túi'] },
  'xe-co': { theme: 'tech', title: 'Tìm người bạn đồng hành mới.', description: 'Khám phá xe đã qua sử dụng. Trao đổi với người bán để kiểm tra giấy tờ và tình trạng trước khi giao dịch.', topics: ['Xe máy', 'Xe đạp', 'Ô tô'] },
  'cho-tang-0d': { theme: 'kitchen', title: 'Bạn không dùng, ai đó đang cần.', description: 'Trao đi món đồ còn tốt, nối dài vòng đời sử dụng và cùng giảm lãng phí.', topics: [] },
};
const CONDITION_NAMES = { NEW: 'Mới, chưa sử dụng', LIKE_NEW: 'Như mới', USED_GOOD: 'Đã dùng, còn tốt', USED_FAIR: 'Đã dùng, có hao mòn', FOR_PARTS: 'Dùng làm linh kiện' };

async function catalogPage(slug) {
  const category = slug ? categories.find(c => c.slug === decodeURIComponent(slug)) : null;
  if (slug && !category) {
    $('#app').innerHTML = '<div class="empty"><div class="e">📦</div><h1>Không tìm thấy danh mục</h1><p>Danh mục có thể đã được gỡ hoặc chưa tải được.</p><a class="btn btn-green" href="#/">Về trang chủ</a></div>';
    return;
  }
  const design = CATEGORY_DESIGNS[category?.slug] || { theme: 'tech', title: 'Đồ cũ, giá trị mới.', description: 'Khám phá các tin đăng trong danh mục và tìm món đồ phù hợp với bạn.', topics: [] };
  const query = { limit: 12, ...currentQuery, ...(category ? { categoryId: category.id } : {}) };
  const [res, banners] = await Promise.all([
    api('/listings?' + new URLSearchParams(query), { auth: false }),
    category ? Promise.resolve([]) : api('/banners?position=HOME_HERO', { auth: false }).catch(() => []),
  ]);
  const page = Math.max(1, res.meta.page), totalPages = Math.max(1, res.meta.totalPages);
  const activeFilters = ['q', 'condition', 'minPrice', 'maxPrice', 'isFree', 'city', 'deliveryMethod', 'verified'].some(k => currentQuery[k]);
  document.title = category ? `${category.name} — Nola2Hand` : currentQuery.q ? `Tìm “${currentQuery.q}” — Nola2Hand` : 'Nola2Hand — Đồ cũ, giá trị mới';
  $('#app').innerHTML = `
    ${category ? `<div class="wrap category-intro"><nav class="crumbs" aria-label="Đường dẫn"><a href="#/">Trang chủ</a> / <span>${esc(category.name)}</span></nav>
      <section class="category-hero ${design.theme}"><div><span class="eyebrow">Khám phá danh mục</span><h1>${esc(category.name)}</h1><h2>${esc(design.title)}</h2><p>${esc(design.description)}</p><div class="chips">${design.topics.map(t => `<a class="chip ${currentQuery.q === t ? 'on' : ''}" href="${esc(catalogUrl(category.slug, { q: t }))}">${esc(t)} ↗</a>`).join('')}</div></div><div class="category-art" aria-hidden="true"><span>${categoryIcon(category.slug)}</span><small>Đồ cũ. Giá trị mới.</small></div></section></div>` : activeFilters || page > 1 ? `<div class="wrap search-intro"><nav class="crumbs" aria-label="Đường dẫn"><a href="#/">Trang chủ</a> / Tìm sản phẩm</nav><h1>${currentQuery.q ? `Kết quả cho “${esc(currentQuery.q)}”` : 'Tìm món đồ phù hợp'}</h1><p class="muted">Điều chỉnh bộ lọc để chọn đúng món bạn cần.</p></div>` : `
      <section class="hero"><div class="wrap"><div class="home-hero"><div class="hero-copy"><span class="hero-kicker">${uiIcon('cycle')} Mua sắm thêm bền vững</span><h1>Mua món mình cần.<br>Giữ điều đáng giá.</h1><p class="muted">Đồ còn tốt, giá dễ mua. Tìm món đồ hợp với bạn<br class="desktop-break"> và trao cơ hội mới cho những điều quen thuộc.</p><div class="hero-actions"><a class="btn btn-green" href="#catalog-results">Khám phá sản phẩm ${uiIcon('arrow')}</a><a class="btn btn-line" href="#/seller">Đăng tin bán đồ</a></div><div class="hero-benefits"><span>${uiIcon('shield')} Ký quỹ SafePay</span><span>${uiIcon('chat')} Trao đổi trực tiếp</span></div></div><div class="hero-visual">${res.data[0] ? `<a class="hero-product" href="#/listing/${res.data[0].id}"><span class="hero-product-tag">Một lựa chọn từ cộng đồng</span><img src="${img(res.data[0].images?.[0]?.url)}" alt="${esc(res.data[0].title)}" onerror="this.src='${IMG_PH}'"><div class="hero-product-caption"><div><span>${esc(res.data[0].category?.name || 'Đồ còn tốt')}</span><strong>${esc(res.data[0].title)}</strong></div><b>${fmtVND(res.data[0].price)}</b></div><span class="hero-product-link">${uiIcon('arrow')}</span></a>` : `<div class="hero-empty">${uiIcon('cycle')}<h2>Cũ với bạn.<br>Mới với ai đó.</h2><a href="#/seller" class="btn btn-green">Đăng món đồ đầu tiên</a></div>`}<span class="visual-note">${uiIcon('heart')} Thêm vòng đời cho đồ tốt</span></div></div><div class="trust-strip"><span>${uiIcon('search')} Tìm theo tình trạng, giá và địa điểm</span><span>${uiIcon('compare')} So sánh trước khi chọn</span><span>${uiIcon('shield')} Tiền cọc được giữ hộ qua SafePay</span></div></div></section>
      <section class="wrap category-discovery"><div class="section-heading"><div><h2>Bạn đang tìm gì?</h2><p class="muted">Bắt đầu từ một danh mục bạn yêu thích.</p></div><a class="text-link" href="#/shops">Khám phá gian hàng ${uiIcon('arrow')}</a></div><div class="catgrid">${categories.map(c => `<a class="catcard cat-${esc(c.slug)}" href="${esc(catalogUrl(c.slug))}"><span class="e">${categoryIcon(c.slug)}</span><b>${esc(c.name)}</b><span>Xem sản phẩm ${uiIcon('arrow')}</span></a>`).join('')}</div>${banners[0] ? `<div class="home-banner card"><img src="${img(banners[0].imageUrl)}" alt="${esc(banners[0].title || 'Ưu đãi Nola2Hand')}" onerror="this.parentElement.remove()"></div>` : ''}</section>`}
    <section class="wrap catalog-section" id="catalog-results">
      <div class="section-heading"><div><span class="eyebrow">${category ? 'Chọn món đồ phù hợp' : 'Đồ tốt đang chờ bạn'}</span><h2>${category ? 'Tin đăng ' + esc(category.name.toLocaleLowerCase('vi')) : 'Khám phá tin đăng'}</h2><button class="btn btn-line btn-sm" onclick="saveSearch()">🔔 Theo dõi tìm kiếm này</button><p class="muted"><b>${res.meta.total}</b> tin đăng${currentQuery.q ? ` cho “${esc(currentQuery.q)}”` : ' đang phù hợp'}</p></div><label class="catalog-sort" for="f-sort">Sắp xếp<select class="input" id="f-sort" onchange="setFilter('sort',this.value)"><option value="">Tin nổi bật</option><option value="newest" ${currentQuery.sort === 'newest' ? 'selected' : ''}>Mới nhất</option><option value="price_asc" ${currentQuery.sort === 'price_asc' ? 'selected' : ''}>Giá thấp đến cao</option><option value="price_desc" ${currentQuery.sort === 'price_desc' ? 'selected' : ''}>Giá cao đến thấp</option></select></label></div>
      <div class="catalog-layout"><aside class="catalog-sidebar"><button type="button" class="btn btn-line filter-toggle" aria-expanded="false" aria-controls="catalog-filters" onclick="toggleCatalogFilters(this)">${uiIcon('filter')} Bộ lọc tìm kiếm</button><form id="catalog-filters" class="filter-panel card" onsubmit="applyCatalogFilters(event)"><div class="filter-title"><h3>${uiIcon('filter')} Bộ lọc tìm kiếm</h3><a href="${esc(catalogUrl(category?.slug))}">Đặt lại</a></div><div class="form-row"><label class="lbl" for="filter-q">Từ khóa</label><input class="input" id="filter-q" value="${esc(currentQuery.q || '')}" placeholder="Tên món đồ..."></div><div class="form-row"><label class="lbl" for="f-city">Địa điểm</label><input class="input" id="f-city" value="${esc(currentQuery.city || '')}" placeholder="Tỉnh / thành phố"></div><div class="form-row"><label class="lbl" for="f-delivery">Giao nhận</label><select class="input" id="f-delivery"><option value="">Tất cả</option><option value="MEETUP" ${currentQuery.deliveryMethod === 'MEETUP' ? 'selected' : ''}>Gặp trực tiếp</option><option value="DELIVERY" ${currentQuery.deliveryMethod === 'DELIVERY' ? 'selected' : ''}>Giao hàng</option></select></div><label class="free-filter"><input id="f-verified" type="checkbox" ${currentQuery.verified === 'true' ? 'checked' : ''}> Người bán đã duyệt danh tính</label><div class="form-row"><label class="lbl" for="f-cond">Tình trạng</label><select class="input" id="f-cond"><option value="">Tất cả tình trạng</option>${Object.entries(CONDITION_NAMES).map(([value, label]) => `<option value="${value}" ${currentQuery.condition === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><fieldset class="price-filter"><legend>Khoảng giá (đ)</legend><label for="f-min" class="sr-only">Giá thấp nhất</label><input class="input" id="f-min" type="number" min="0" step="1" placeholder="Từ" value="${esc(currentQuery.minPrice || '')}"><span>—</span><label for="f-max" class="sr-only">Giá cao nhất</label><input class="input" id="f-max" type="number" min="0" step="1" placeholder="Đến" value="${esc(currentQuery.maxPrice || '')}"></fieldset><label class="free-filter"><input id="f-free" type="checkbox" ${currentQuery.isFree === 'true' ? 'checked' : ''}> Chỉ xem đồ cho tặng 0đ</label><p id="filter-error" class="filter-error" role="alert"></p><button class="btn btn-green" type="submit">Áp dụng bộ lọc</button></form><nav class="category-links card" aria-label="Các danh mục"><h3>Danh mục khác</h3><a href="#/">Tất cả tin đăng</a>${categories.map(c => `<a href="${esc(catalogUrl(c.slug))}" ${c.id === category?.id ? 'aria-current="page"' : ''}>${categoryIcon(c.slug)} ${esc(c.name)} <span>›</span></a>`).join('')}</nav><div class="safepay-note"><span aria-hidden="true">${uiIcon('shield')}</span><b>Tiền cọc được giữ hộ</b><p>Ví SafePay giữ tiền cọc trong khi đơn hàng được xử lý. Xem kỹ tình trạng và trao đổi với người bán trước khi mua.</p></div></aside>
      <div class="catalog-products">${activeFilters ? `<div class="active-filters"><div class="filter-chips">${Object.entries(currentQuery).filter(([k,v]) => v && !['page','sort'].includes(k)).map(([k,v]) => `<button type="button" class="chip" onclick="setFilter('${esc(k)}','')">${esc(({q:'Từ khóa',condition:'Tình trạng',minPrice:'Từ',maxPrice:'Đến',city:'Địa điểm',deliveryMethod:'Giao nhận',verified:'Xác minh',isFree:'Cho tặng'})[k] || k)}: ${esc(CONDITION_NAMES[v] || ({MEETUP:'Gặp trực tiếp',DELIVERY:'Giao hàng',true:'Có'})[v] || v)} ×</button>`).join('')}</div><a href="${esc(catalogUrl(category?.slug))}">Xóa bộ lọc ✕</a></div>` : ''}<div class="pgrid">${res.data.map(listingCard).join('') || `<div class="empty catalog-empty"><div class="e">${esc(category?.icon || '📦')}</div><h3>${activeFilters ? 'Chưa tìm thấy món đồ phù hợp' : 'Danh mục này chưa có tin đăng'}</h3><p>${activeFilters ? 'Thử thay đổi từ khóa hoặc mở rộng khoảng giá.' : 'Bạn có món đồ thuộc danh mục này? Hãy là người đăng tin đầu tiên.'}</p><a class="btn btn-green" href="${activeFilters ? esc(catalogUrl(category?.slug)) : '#/seller/new'}">${activeFilters ? 'Xóa bộ lọc' : 'Đăng tin bán đồ'}</a><a class="btn btn-line" href="#/">Khám phá tất cả tin đăng</a></div>`}</div><nav class="catalog-pagination" aria-label="Phân trang tin đăng"><button class="btn btn-line btn-sm" onclick="setFilter('page',${page - 1})" ${page <= 1 ? 'disabled' : ''}>← Trước</button><span>Trang <b>${page}</b> / ${totalPages}</span><button class="btn btn-line btn-sm" onclick="setFilter('page',${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Sau →</button></nav></div></div>
      ${category || activeFilters || page > 1 ? '' : await recommendedSection()}
    </section>`;
  // Hash routing owns navigation; the home CTA scrolls without changing its route.
  const explore = document.querySelector('.hero-actions a');
  if (explore) explore.addEventListener('click', event => { event.preventDefault(); $('#catalog-results').scrollIntoView({ behavior: 'smooth' }); });
}
route('', () => catalogPage());
route('category', catalogPage);
function setFilter(k, v) {
  const query = { ...currentQuery };
  if (k !== 'page') delete query.page;
  v ? query[k] = v : delete query[k];
  location.hash = catalogUrl(catalogSlug(), query);
}
function applyCatalogFilters(event) {
  event.preventDefault();
  const min = $('#f-min').value, max = $('#f-max').value;
  if ((min && (!Number.isFinite(+min) || +min < 0)) || (max && (!Number.isFinite(+max) || +max < 0)) || (min && max && +min > +max)) {
    $('#filter-error').textContent = 'Giá phải không âm; giá đến phải lớn hơn hoặc bằng giá từ.';
    return;
  }
  location.hash = catalogUrl(catalogSlug(), { q: $('#filter-q').value.trim(), condition: $('#f-cond').value, minPrice: min, maxPrice: max, isFree: $('#f-free').checked ? 'true' : '', sort: currentQuery.sort, city: $('#f-city').value.trim(), deliveryMethod: $('#f-delivery').value, verified: $('#f-verified').checked ? 'true' : '' });
}

function toggleCatalogFilters(button) {
  const open = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(open));
  $('#catalog-filters').classList.toggle('filters-open', open);
}
function finishView(name) {
  if (!document.querySelectorAll) return;
  document.querySelectorAll('#app h1,#app h2,#app h3').forEach(heading => {
    const node = heading.firstChild;
    if (node?.nodeType === Node.TEXT_NODE) node.textContent = node.textContent.replace(/^[\s\p{Extended_Pictographic}\uFE0F]+/u, '');
  });
  const account = [['profile','user','Hồ sơ'],['orders','orders','Đơn mua'],['returns','return','Trả hàng'],['wallet','wallet','Ví SafePay'],['favorites','heart','Đã lưu'],['notifications','bell','Thông báo']];
  if (store.token && account.some(([path])=>path===name)) {
    const heading = $('#app .wrap')?.querySelector('h1');
    heading?.insertAdjacentHTML('afterend', `<nav class="account-nav" aria-label="Tài khoản">${account.map(([path,icon,label])=>`<a href="#/${path}" ${path===name?'aria-current="page"':''}>${uiIcon(icon)}${label}</a>`).join('')}</nav>`);
  }
  labelFields($('#app'));
  decorateActionIcons($('#app'));
  document.querySelectorAll('#app .empty .e').forEach(el=>{el.innerHTML=uiIcon(({cart:'cart',chat:'chat',favorites:'heart',orders:'orders',returns:'return',notifications:'bell',shops:'shop'})[name]||'box');});
}
function labelFields(root) {
  root?.querySelectorAll?.('.form-row').forEach((row,index)=>{
    const label=row.querySelector('label.lbl'),input=row.querySelector('input,textarea,select');
    if(label&&input&&!label.htmlFor){input.id ||= 'field-'+index;label.htmlFor=input.id;}
  });
}
function decorateActionIcons(root) {
  if (!root?.querySelectorAll) return;
  const icons={'🔔':'bell','🤍':'heart','❤️':'heart','💬':'chat','🛒':'cart','💳':'wallet','💰':'wallet','👛':'wallet','🏦':'wallet','🛡️':'shield','🛡':'shield','🏪':'shop','📍':'pin','🔍':'search','📦':'box','🧾':'orders','⭐':'star','✨':'star','📈':'chart','＋':'plus','⇄':'compare','📊':'chart'};
  root.querySelectorAll('button,a.btn').forEach(el=>{
    const node=el.firstChild;if(node?.nodeType!==Node.TEXT_NODE)return;
    const text=node.textContent.trimStart(),match=Object.keys(icons).find(icon=>text.startsWith(icon));
    if(!match)return;node.textContent=text.slice(match.length).trimStart();el.insertAdjacentHTML('afterbegin',uiIcon(icons[match]));
  });
}
let viewedListing;
route('listing', async (id) => {
  const l = await api('/listings/' + id, { auth: false });
  viewedListing = l;
  const thumb = l.images?.[0]?.url;
  $('#app').innerHTML = `
  <div class="wrap">
    <div class="crumbs"><a onclick="location.hash='#/'">Trang chủ</a> / <a onclick="goCat(${l.categoryId})">${esc(l.category?.name || '')}</a> / <b style="color:var(--ink)">${esc(l.title.slice(0, 40))}...</b></div>
    <div class="card" style="padding:28px"><div class="dgrid">
      <div class="gallery">
        <img class="main" id="gmain" alt="${esc(l.title)}" src="${img(thumb)}" onerror="this.src='${IMG_PH}'">
        <div class="thumbs">${(l.images || []).map((im, i) => `<img src="${img(im.url)}" alt="${esc(l.title)} — ảnh ${i + 1}" class="${i === 0 ? 'on' : ''}" onclick="document.getElementById('gmain').src=this.src;document.querySelectorAll('.thumbs img').forEach(x=>x.classList.remove('on'));this.classList.add('on')" onerror="this.src='${IMG_PH}'">`).join('')}</div>
        <div class="card" style="padding:20px;margin-top:18px;box-shadow:none"><h3 style="font-size:15px;margin-bottom:10px">📝 Mô tả chi tiết</h3><p style="font-size:13.5px;white-space:pre-wrap">${esc(l.description)}</p></div>
      </div>
      <div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${l.isVerified ? '<span class="badge b-green">✨ Đã kiểm định</span>' : ''}<span class="badge b-gray">👁 ${l.views || 0} lượt xem</span></div>
        <h1 style="font-size:22px;margin:12px 0 6px">${esc(l.title)}</h1>
        <div style="font-size:28px;font-weight:800;color:var(--green-dark)">${l.isFree ? '🎁 Cho tặng 0đ' : fmtVND(l.price)}</div>
        <div class="card" style="padding:16px;display:flex;gap:12px;align-items:center;margin:16px 0;box-shadow:none">
          ${avatarHtml(l.seller, 48)}
          <div style="flex:1"><b>${esc(l.seller?.fullName || '')}</b> ${l.seller?.emailVerifiedAt ? '<span class="badge b-blue">✓ Email đã xác nhận</span>' : ''} ${l.seller?.idVerified ? '<span class="badge b-green">✓ Danh tính đã duyệt</span>' : ''}
          <a class="text-link shop-profile-link" href="#/shop/${l.sellerId}">Xem hồ sơ uy tín ${uiIcon('arrow')}</a></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <button class="btn btn-line" onclick="toggleFav(${l.id},this)">🤍 Lưu tin</button>
          <button class="btn btn-dark" onclick="startChat(${l.seller?.id},${l.id})">💬 Chat</button>
        </div>
        <button class="btn btn-green" style="width:100%;padding:14px" onclick="offerModal(${l.id},${l.price},'${esc(l.title).replace(/'/g, "\\'")}')">💰 Trả giá</button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
          <button class="btn btn-line" style="padding:14px" onclick="addToCart(${l.id})">🛒 Thêm vào giỏ</button>
          <button class="btn btn-green" style="padding:14px" onclick="buyNow(${l.id})">Mua ngay</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;background:var(--green-softer);border-radius:10px;padding:12px">
          <span>${uiIcon('shield')}</span><div class="muted" style="font-size:12px"><b style="color:var(--ink)">SafePay:</b> tiền được giữ hộ đến khi bạn nhận hàng & đồng kiểm ưng ý.</div>
        </div>
      </div>
    </div></div>
    <div id="related-box" style="margin-top:26px"></div>
  </div>`;
  loadRelated(id);
});
async function loadRelated(id) {
  try {
    const r = await api(`/listings/${id}/related?limit=4`, { auth: false });
    const box = $('#related-box');
    if (box && r.items.length) box.innerHTML = `<h2 style="font-size:18px;margin-bottom:14px">💡 Có thể bạn cũng thích</h2><div class="pgrid">${r.items.map(listingCard).join('')}</div>`;
  } catch {}
}
function offerModal(listingId, price, title) {
  if (!store.token) { location.hash = '#/login'; return; }
  openModal(`<h3 style="margin-bottom:6px">💰 Trả giá</h3><p class="muted" style="font-size:13px;margin-bottom:16px">${esc(title)}<br>Giá niêm yết: <b>${fmtVND(price)}</b></p>
    <div class="form-row"><label class="lbl">Giá đề xuất (đ)</label><input class="input" id="off-price" type="number" placeholder="vd: 450000"></div>
    <div class="form-row"><label class="lbl">Nhận hàng</label><select class="input" id="off-ship"><option value="NOLA_SHIP">🚚 Giao hàng NoLa</option><option value="MEETUP">🤝 Gặp mặt trực tiếp</option></select></div>
    <div class="form-row"><label class="lbl">Lời nhắn</label><textarea class="input" id="off-msg" rows="2" placeholder="Nhắn gửi người bán..."></textarea></div>
    <button class="btn btn-green" style="width:100%" onclick="sendOffer(${listingId})">Gửi yêu cầu (hiệu lực 24h)</button>`);
}
async function sendOffer(listingId) {
  const offeredPrice = +$('#off-price').value;
  try {
    await api(`/listings/${listingId}/offers`, { method: 'POST', body: { offeredPrice, message: $('#off-msg').value, shipMethod: $('#off-ship').value } });
    closeModal(); toast('Đã gửi yêu cầu trả giá!', 'ok'); location.hash = '#/offers';
  } catch (e) { toast(e.message, 'err'); }
}
function buyNow(listingId) {
  if (!store.token) { location.hash = '#/login'; return; }
  openModal(`<h3 style="margin-bottom:16px">🛒 Xác nhận mua</h3>
    <div class="form-row"><label class="lbl">Người nhận *</label><input class="input" id="od-name" value="${esc(store.user.fullName)}"></div>
    <div class="form-row"><label class="lbl">Số điện thoại *</label><input class="input" id="od-phone"></div>
    <div class="form-row"><label class="lbl">Địa chỉ giao hàng *</label><input class="input" id="od-addr" placeholder="Số nhà, đường, phường/xã, tỉnh/thành"></div>
    <div class="form-row"><label class="lbl">Ghi chú</label><textarea class="input" id="od-note" rows="2"></textarea></div>
    <button class="btn btn-green" style="width:100%" onclick="createOrder(${listingId})">Tạo đơn hàng</button>`);
}
function validPhone(v) { return /^(\+84|0)(3|5|7|8|9)\d{8}$/.test((v || '').trim()); }
async function createOrder(listingId, offerId) {
  if (!$('#od-name').value.trim()) { toast('Nhập tên người nhận', 'err'); return; }
  if (!validPhone($('#od-phone').value)) { toast('SĐT giao hàng chưa đúng (VD: 0987654321)', 'err'); return; }
  if (!$('#od-addr').value.trim()) { toast('Nhập địa chỉ giao hàng', 'err'); return; }
  try {
    const order = await api('/orders', { method: 'POST', body: {
      listingId, offerId: offerId || undefined,
      shipName: $('#od-name').value, shipPhone: $('#od-phone').value, shipAddress: $('#od-addr').value,
      note: $('#od-note').value, paymentMethod: 'MOMO_QR',
    }});
    closeModal(); toast('Tạo đơn thành công!', 'ok'); location.hash = '#/orders/' + order.id;
  } catch (e) { toast(e.message, 'err'); }
}

route('login', async () => {
  if (store.token) { location.hash = '#/'; return; }
  $('#app').innerHTML = `<div class="auth-wrap">
    <div class="auth-side"><div class="logo" style="color:#fff;font-size:27px;margin-bottom:24px"><span style="color:#7ee787">NOLA</span>2HAND</div>
      <h1 style="font-size:38px;font-weight:800;line-height:1.2">Chào mừng<br>trở lại 👋</h1>
      <p style="margin-top:12px;opacity:.88">Đăng nhập để săn đồ cũ chất lượng, giá tốt.</p></div>
    <div class="auth-form"><h2 style="font-size:26px;font-weight:800;margin-bottom:20px">Đăng nhập</h2>
      <form onsubmit="return doLogin(event)">
      <div class="form-row"><label class="lbl">Email</label><input class="input" id="li-email" type="email" required value="buyer@nola2hand.vn"></div>
      <div class="form-row"><label class="lbl">Mật khẩu</label><input class="input" id="li-pass" type="password" required value="123456"></div>
      <button class="btn btn-green" style="width:100%">Đăng nhập</button></form>
      <div id="google-btn" style="margin-top:14px;display:flex;justify-content:center"></div>
      <p style="text-align:right;margin-top:10px"><a href="#/forgot" style="color:var(--blue);font-size:13px">Quên mật khẩu?</a></p>
      <p class="muted" style="text-align:center;margin-top:18px;font-size:13.5px">Chưa có tài khoản? <a href="#/register" style="color:var(--blue);font-weight:600">Đăng ký</a></p>
      <p class="muted" style="font-size:12px;margin-top:12px;background:var(--green-softer);padding:10px 14px;border-radius:10px">Demo: buyer@nola2hand.vn · seller@nola2hand.vn · finance@nola2hand.vn · content@nola2hand.vn<br>Mật khẩu: <b>123456</b></p>
    </div></div>`;
  initGoogleBtn();
});
async function doLogin(e) {
  e.preventDefault();
  try {
    const r = await api('/auth/login', { method: 'POST', auth: false, body: { email: $('#li-email').value, password: $('#li-pass').value } });
    store.token = r.token; store.user = r.user;
    toast('Đăng nhập thành công!', 'ok'); renderFooter();
    location.hash = hasRole('ADMIN_FINANCE', 'ADMIN_CONTENT') ? '#/admin' : '#/';
  } catch (err) { toast(err.message, 'err'); }
  return false;
}
route('register', async () => {
  $('#app').innerHTML = `<div class="auth-wrap"><div class="auth-form" style="grid-column:1/-1;max-width:480px">
    <h2 style="font-size:26px;font-weight:800;margin-bottom:6px">Tạo tài khoản</h2><p class="muted" style="margin-bottom:20px">Khám phá đồ cũ chất lượng, giá tốt.</p>
    <form onsubmit="return doRegister(event)" novalidate>
    <div class="form-row"><label class="lbl" for="rg-name">Họ và tên</label><input class="input" id="rg-name" required minlength="2" maxlength="100" autocomplete="name" placeholder="VD: Nguyễn Văn A"><p class="field-err" id="rg-name-err"></p></div>
    <div class="form-row"><label class="lbl" for="rg-email">Email</label><input class="input" id="rg-email" type="email" required autocomplete="email" placeholder="ban@email.com"><p class="field-err" id="rg-email-err"></p></div>
    <div class="form-row"><label class="lbl" for="rg-pass">Mật khẩu (≥6 ký tự)</label><div class="pass-wrap"><input class="input" id="rg-pass" type="password" required minlength="6" maxlength="72" autocomplete="new-password"><button type="button" class="pass-toggle" onclick="togglePass('rg-pass',this)" aria-label="Hiện mật khẩu">👁</button></div><p class="field-err" id="rg-pass-err"></p><p class="muted" style="font-size:12px">Mật khẩu cần có cả chữ và số. Mật khẩu mạnh nên dài ≥8 ký tự, có chữ hoa hoặc ký tự đặc biệt.</p></div>
    <div class="form-row"><label class="lbl" for="rg-pass2">Nhập lại mật khẩu</label><div class="pass-wrap"><input class="input" id="rg-pass2" type="password" required minlength="6" maxlength="72" autocomplete="new-password"><button type="button" class="pass-toggle" onclick="togglePass('rg-pass2',this)" aria-label="Hiện mật khẩu">👁</button></div><p class="field-err" id="rg-pass2-err"></p></div>
    <button class="btn btn-green" style="width:100%">Đăng ký</button></form>
    <p class="muted" style="text-align:center;margin-top:18px;font-size:13.5px">Đã có tài khoản? <a href="#/login" style="color:var(--blue);font-weight:600">Đăng nhập</a></p></div></div>`;
});
function initGoogleBtn() {
  const box = $('#google-btn');
  if (!box) return;
  if (!GOOGLE_CLIENT_ID) {
    box.innerHTML = `<p class="muted" style="font-size:11.5px;text-align:center">Đăng nhập Google chưa khả dụng. Bạn có thể đăng nhập bằng email.</p>`;
    return;
  }
  if (!window.google || !google.accounts) { setTimeout(initGoogleBtn, 500); return; }
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: googleLogin });
  google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', width: 300, text: 'signin_with' });
}
async function googleLogin(resp) {
  try {
    const r = await api('/auth/google', { method: 'POST', auth: false, body: { idToken: resp.credential } });
    store.token = r.token; store.user = r.user;
    toast('Đăng nhập Google thành công! 👋', 'ok'); renderFooter();
    location.hash = hasRole('ADMIN_FINANCE', 'ADMIN_CONTENT') ? '#/admin' : '#/';
  } catch (e) { toast(e.message, 'err'); }
}
let pendingOtpEmail = '';
function togglePass(id, btn) {
  const i = document.getElementById(id), show = i.type === 'password';
  i.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
  btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
}
function setFieldErr(id, msg) { const p = document.getElementById(id); if (p) { p.textContent = msg || ''; p.style.display = msg ? 'block' : 'none'; } return !msg; }
function doRegister(e) {
  e.preventDefault();
  const name = $('#rg-name').value.trim(), email = $('#rg-email').value.trim(), pass = $('#rg-pass').value, pass2 = $('#rg-pass2').value;
  let ok = true;
  ok = setFieldErr('rg-name-err', name.length < 2 ? 'Họ tên tối thiểu 2 ký tự' : name.length > 100 ? 'Họ tên tối đa 100 ký tự' : '') && ok;
  ok = setFieldErr('rg-email-err', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Email chưa đúng định dạng') && ok;
  ok = setFieldErr('rg-pass-err', pass.length < 6 ? 'Mật khẩu tối thiểu 6 ký tự' : pass.length > 72 ? 'Mật khẩu tối đa 72 ký tự' : '') && ok;
  ok = setFieldErr('rg-pass2-err', pass !== pass2 ? 'Mật khẩu nhập lại không khớp' : '') && ok;
  if (!ok) return false;
  doRegisterSubmit({ fullName: name, email, password: pass });
  return false;
}
async function doRegisterSubmit(body) {
  try {
    const r = await api('/auth/register', { method: 'POST', auth: false, body });
    store.token = r.token; store.user = { ...r.user, roles: ['BUYER'] };
    pendingOtpEmail = body.email;
    toast(r.message, 'ok'); renderFooter(); location.hash = '#/verify-otp';
  } catch (err) {
    // Email trùng (409) báo ngay dưới ô email thay vì toast chung.
    if (err.status === 409) setFieldErr('rg-email-err', err.message);
    else toast(err.message, 'err');
  }
}
route('verify-otp', async () => {
  $('#app').innerHTML = `<div class="auth-wrap"><div class="auth-form" style="grid-column:1/-1;max-width:440px">
    <h2 style="font-size:24px;font-weight:800;margin-bottom:6px">✉️ Nhập mã OTP</h2>
    <p class="muted" style="margin-bottom:20px;font-size:13.5px">Mã 6 số đã gửi tới email (hiệu lực 10 phút). Chưa cấu hình mail thật thì mở file mới nhất trong <b>.local/mail/</b>.</p>
    <form onsubmit="return doVerifyOtp(event)">
    <div class="form-row"><label class="lbl">Email</label><input class="input" id="vo-email" type="email" required value="${esc(pendingOtpEmail)}"></div>
    <div class="form-row"><label class="lbl">Mã OTP 6 số</label><input class="input" id="vo-otp" required inputmode="numeric" pattern="\\d{6}" maxlength="6" minlength="6" placeholder="••••••" style="font-size:22px;letter-spacing:8px;text-align:center"></div>
    <button class="btn btn-green" style="width:100%">Xác nhận</button></form>
    <p style="text-align:center;margin-top:14px"><button class="btn btn-line btn-sm" onclick="resendOtp('vo-email')">Gửi lại mã</button></p></div></div>`;
});
async function doVerifyOtp(e) {
  e.preventDefault();
  try {
    const r = await api('/auth/verify-otp', { method: 'POST', auth: false, body: { email: $('#vo-email').value, otp: $('#vo-otp').value.trim() } });
    toast(r.message + ' 🎉', 'ok'); location.hash = '#/';
  } catch (err) { toast(err.message, 'err'); }
  return false;
}
async function resendOtp(inputId) {
  try {
    const r = await api('/auth/resend-verification', { method: 'POST', auth: false, body: { email: document.getElementById(inputId).value } });
    toast(r.message, 'ok');
  } catch (err) { toast(err.message, 'err'); }
}

route('favorites', async () => {
  if (!store.token) { location.hash = '#/login'; return; }
  const res = await api('/listings/me/favorites');
  $('#app').innerHTML = `<div class="wrap"><h1 style="font-size:23px;margin-bottom:16px">🤍 Tin đã lưu (${res.meta.total})</h1>
    <div class="pgrid">${res.data.map((f) => listingCard(f.listing)).join('') || `<div class="empty"><div class="e">🤍</div>Chưa lưu tin nào.</div>`}</div></div>`;
});

route('offers', async () => {
  if (!store.token) { location.hash = '#/login'; return; }
  const res = await api('/offers/mine');
  const badge = { PENDING: 'p-warn', ACCEPTED: 'p-ok', REJECTED: 'p-bad', CANCELLED: 'p-mut', EXPIRED: 'p-mut' };
  $('#app').innerHTML = `<div class="wrap"><h1 style="font-size:23px;margin-bottom:16px">💰 Yêu cầu trả giá của tôi</h1>
    ${res.data.map((o) => `<div class="card" style="padding:18px;margin-bottom:12px;display:flex;gap:16px;align-items:center">
      <img src="${img(o.listing.images?.[0]?.url)}" style="width:110px;height:88px;object-fit:cover;border-radius:10px" onerror="this.src='${IMG_PH}'">
      <div style="flex:1"><b>${esc(o.listing.title)}</b><div class="muted" style="font-size:12px">${esc(o.listing.seller?.fullName || '')}</div>
      <div style="margin-top:6px">Đề xuất: <b style="color:var(--green-dark);font-size:17px">${fmtVND(o.offeredPrice)}</b> <span class="pill ${badge[o.status]}">${(OFFER_ST[o.status] || [o.status])[0]}</span></div></div>
      <div style="display:flex;gap:8px;flex-direction:column">
        ${o.status === 'ACCEPTED' ? `<button class="btn btn-green btn-sm" onclick="buyWithOffer(${o.listingId},${o.id})">🛒 Mua với giá này</button>` : ''}
        ${o.status === 'PENDING' ? `<button class="btn btn-line btn-sm" onclick="offerAction(${o.id},'CANCEL')">Huỷ</button>` : ''}
        <button class="btn btn-line btn-sm" onclick="location.hash='#/listing/${o.listingId}'">Xem tin</button>
      </div></div>`).join('') || `<div class="empty"><div class="e">💰</div>Chưa có yêu cầu nào.</div>`}</div>`;
});
function buyWithOffer(listingId, offerId) {
  openModal(`<h3 style="margin-bottom:16px">🛒 Mua với giá đã thương lượng</h3>
    <div class="form-row"><label class="lbl">Người nhận *</label><input class="input" id="od-name" value="${esc(store.user.fullName)}"></div>
    <div class="form-row"><label class="lbl">Số điện thoại *</label><input class="input" id="od-phone"></div>
    <div class="form-row"><label class="lbl">Địa chỉ *</label><input class="input" id="od-addr"></div>
    <button class="btn btn-green" style="width:100%" onclick="createOrder(${listingId},${offerId})">Tạo đơn hàng</button>`);
}
async function offerAction(id, action) {
  try { await api(`/offers/${id}`, { method: 'PATCH', body: { action } }); toast('Đã cập nhật', 'ok'); render(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ---------- orders ---------- */
route('orders', async () => {
  if (!store.token) { location.hash = '#/login'; return; }
  const [mine, sales] = await Promise.all([
    api('/orders/mine').catch(() => ({ data: [] })),
    hasRole('SELLER') ? api('/orders/sales').catch(() => ({ data: [] })) : { data: [] },
  ]);
  const row = (o) => `<div class="card" style="padding:16px 20px;margin-bottom:12px;display:flex;gap:16px;align-items:center;cursor:pointer" onclick="location.hash='#/orders/${o.id}'">
    <img src="${img(o.listing.images?.[0]?.url)}" style="width:96px;height:76px;object-fit:cover;border-radius:10px" onerror="this.src='${IMG_PH}'">
    <div style="flex:1"><b>#${esc(o.code)}</b> ${stPill(o.status)}<div style="font-size:13px;margin-top:4px">${esc(o.listing.title)}</div>
    <div class="muted" style="font-size:11.5px">${fmtDate(o.createdAt)}</div></div>
    <b style="color:var(--green-dark)">${fmtVND(o.totalAmount)}</b></div>`;
  $('#app').innerHTML = `<div class="wrap"><h1 style="font-size:23px;margin-bottom:16px">📦 Đơn hàng</h1>
    <h3 style="margin:14px 0 10px">Đơn tôi mua (${mine.data.length})</h3>${mine.data.map(row).join('') || '<p class="muted">Chưa có đơn nào.</p>'}
    ${hasRole('SELLER') ? `<h3 style="margin:22px 0 10px">Đơn tôi bán (${sales.data.length})</h3>${sales.data.map(row).join('') || '<p class="muted">Chưa có đơn nào.</p>'}` : ''}</div>`;
});

// hash '#/orders/123' -> name='orders', param='123'
const _ordersRoute = routes['orders'];
route('orders', async (param) => {
  if (param) return orderDetail(param);
  return _ordersRoute();
});

let viewedOrder;
async function orderDetail(id) {
  if (!store.token) { location.hash = '#/login'; return; }
  const o = await api('/orders/' + id);
  viewedOrder = o;
  const isBuyer = o.buyerId === store.user.id, isSeller = o.sellerId === store.user.id;
  const tl = (o.timeline || []).map((t, i) =>
    `<div class="tl-item ${i < o.timeline.length ? 'done' : ''}"><b style="font-size:12.5px">${esc((ORDER_ST[t.status] || [])[0] || (typeof WORKFLOW_LABELS !== 'undefined' && WORKFLOW_LABELS[t.status]) || t.status.replace(/^RETURN_/, 'Trả hàng: '))}</b><div style="font-size:13px">${esc(t.note || '')}</div><div class="muted" style="font-size:11px">${fmtDate(t.createdAt)}</div></div>`).join('');
  let actions = '';
  if (isBuyer && o.status === 'PENDING_DEPOSIT')
    actions += `<button class="btn btn-green" style="width:100%;margin-bottom:10px" onclick="depositModal(${o.id},${o.totalAmount})">🔒 Đặt cọc giữ hàng (SafePay)</button>`;
  if (isBuyer && ['DEPOSITED', 'CONFIRMED', 'SHIPPING', 'DELIVERED'].includes(o.status) && o.remainingAmount > 0)
    actions += `<button class="btn btn-line" style="width:100%;margin-bottom:10px" onclick="payRemainder(${o.id},${o.remainingAmount})">Thanh toán còn lại qua ví: ${fmtVND(o.remainingAmount)}</button>`;
  if (isSeller && o.status === 'DELIVERED' && o.settlementMethod === 'COD' && o.remainingAmount > 0)
    actions += `<button class="btn btn-line" style="width:100%;margin-bottom:10px" onclick="confirmCod(${o.id},${o.remainingAmount})">Xác nhận đã thu COD</button>`;
  if (isBuyer && o.status === 'DELIVERED')
    actions += `<button class="btn btn-green" style="width:100%;margin-bottom:10px" onclick="orderStatus(${o.id},'COMPLETED')">✅ Xác nhận đã nhận hàng</button>`;
  if (isBuyer && ['SHIPPING', 'DELIVERED', 'DEPOSITED', 'CONFIRMED'].includes(o.status))
    actions += `<button class="btn btn-line" style="width:100%;margin-bottom:10px" onclick="disputeModal(${o.id})">⚠️ Mở tranh chấp / khiếu nại</button>`;
  if (isBuyer && o.status === 'COMPLETED' && !o.review)
    actions += `<button class="btn btn-line" style="width:100%;margin-bottom:10px" onclick="reviewModal(${o.id})">⭐ Đánh giá người bán</button>`;
  if (isSeller && o.status === 'DEPOSITED')
    actions += `<div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn btn-green" style="flex:1" onclick="orderStatus(${o.id},'CONFIRMED')">Xác nhận đơn</button><button class="btn btn-line" style="flex:1" onclick="orderStatus(${o.id},'CANCELLED')">Huỷ</button></div>`;
  if (isSeller && o.status === 'CONFIRMED')
    actions += `<button class="btn btn-green" style="width:100%;margin-bottom:10px" onclick="shipModal(${o.id})">🚚 Xác nhận gửi hàng</button>`;
  if (isSeller && o.status === 'SHIPPING')
    actions += `<button class="btn btn-green" style="width:100%;margin-bottom:10px" onclick="orderStatus(${o.id},'DELIVERED')">📬 Đã giao tới buyer</button>`;
  if (['PENDING_DEPOSIT'].includes(o.status))
    actions += `<button class="btn btn-line" style="width:100%;color:var(--red);border-color:#f3c1c1" onclick="orderStatus(${o.id},'CANCELLED')">Huỷ đơn</button>`;

  $('#app').innerHTML = `<div class="wrap">
    <div class="crumbs"><a onclick="location.hash='#/orders'">Đơn hàng</a> / <b style="color:var(--ink)">#${esc(o.code)}</b></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h1 style="font-size:23px">Đơn #${esc(o.code)}</h1>${stPill(o.status)}</div>
    <div class="row2" style="grid-template-columns:1.4fr 1fr;align-items:start">
      <div>
        <div class="card" style="padding:20px;margin-bottom:14px"><div style="display:flex;gap:14px">
          <img src="${img(o.listing.images?.[0]?.url)}" style="width:110px;height:90px;object-fit:cover;border-radius:10px" onerror="this.src='${IMG_PH}'">
          <div><b>${esc(o.listing.title)}</b><div class="muted" style="font-size:12px;margin-top:4px">Người bán: ${esc(o.seller.fullName)} · Người mua: ${esc(o.buyer.fullName)}</div>
          <div style="margin-top:6px">Giá chốt: <b style="color:var(--green-dark)">${fmtVND(o.priceAgreed)}</b></div></div></div>
          <div style="display:grid;gap:8px;font-size:13px;margin-top:14px">
            <div style="display:flex;justify-content:space-between"><span class="muted">Tiền cọc</span><b>${fmtVND(o.depositAmount)}</b></div>
            <div style="display:flex;justify-content:space-between"><span class="muted">Còn lại</span><b>${fmtVND(o.remainingAmount)}</b></div>
            <div style="display:flex;justify-content:space-between"><span class="muted">Ship</span><b>${fmtVND(o.shippingFee)}</b></div>
            <p class="muted">${o.settlementMethod === 'WALLET' ? 'Phần còn lại thanh toán qua ví, tiền giữ trong SafePay.' : 'Phần còn lại thu COD khi nhận hàng, gồm phí giao hàng. Người bán xác nhận thu tiền, người mua xác nhận hoàn tất.'}</p>
            ${o.reservationExpiresAt && o.status === 'PENDING_DEPOSIT' ? `<p class="badge b-amber">Giữ món đến ${esc(fmtDate(o.reservationExpiresAt))}</p>` : ''}
            ${o.codCollectedAt ? '<p class="badge b-green">Người bán đã khai báo thu COD</p>' : ''}
            <div style="display:flex;justify-content:space-between;border-top:1px dashed var(--line);padding-top:10px"><span><b>Tổng</b></span><b style="font-size:18px;color:var(--green-dark)">${fmtVND(o.totalAmount)}</b></div>
            ${o.escrow ? `<div style="display:flex;justify-content:space-between"><span class="muted">Ký quỹ SafePay</span><span class="pill ${o.escrow.status === 'HELD' ? 'p-warn' : 'p-ok'}">${ESCROW_STATUS_NAMES[o.escrow.status] || o.escrow.status} · ${fmtVND(o.escrow.amount)}</span></div>` : ''}
          </div></div>
        <div class="card" style="padding:20px"><h3 style="font-size:15px;margin-bottom:14px">Lịch sử đơn hàng</h3><div class="tl">${tl || '<p class="muted">Chưa có.</p>'}</div></div>
      </div>
      <div>
        <div class="card" style="padding:20px;margin-bottom:14px"><h3 style="font-size:15px;margin-bottom:10px">📍 Giao nhận</h3>
          <div style="font-size:13px"><b>${esc(o.shipName || '')}</b> · ${esc(o.shipPhone || '')}<div class="muted">${esc(o.shipAddress || '')}</div>
          ${o.trackingCode ? `<div style="margin-top:8px">Mã vận đơn: <b>${esc(o.trackingCode)}</b></div>` : ''}</div></div>
        <div class="card" style="padding:20px"><h3 style="font-size:15px;margin-bottom:12px">Thao tác</h3>${actions || '<p class="muted" style="font-size:13px">Không có thao tác khả dụng.</p>'}</div>
      </div>
    </div></div>`;
}
function depositModal(orderId, price) {
  const min = Math.ceil(price * 0.1), rec = Math.ceil(price * 0.2);
  openModal(`<h3 style="margin-bottom:6px">🔒 Đặt cọc SafePay</h3><p class="muted" style="font-size:12.5px;margin-bottom:14px">Tối thiểu 10% (${fmtVND(min)}). Tiền được giữ hộ, chỉ chuyển cho seller khi bạn xác nhận nhận hàng.</p>
    <div class="form-row"><label class="lbl">Số tiền cọc (đ)</label><input class="input" id="dep-amt" type="number" value="${rec}"></div>
    <div class="form-row"><label class="lbl">Phương thức</label><select class="input" id="dep-method"><option value="SAFEPAY_WALLET">👛 Ví SafePay</option></select><p class="muted" style="font-size:12px;margin-top:6px">MoMo, VietQR và chuyển khoản sẽ mở khi có webhook xác minh thanh toán.</p></div>
    <button class="btn btn-green" style="width:100%" onclick="doDeposit(${orderId})">Xác nhận đặt cọc</button>`);
}
async function doDeposit(orderId) {
  try {
    await api(`/escrow/orders/${orderId}/deposit`, { method: 'POST', body: { amount: +$('#dep-amt').value, paymentMethod: $('#dep-method').value } });
    closeModal(); toast('Đặt cọc thành công! 🎉', 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function payRemainder(id, amount) {
  if (!confirm(`Thanh toán ${fmtVND(amount)} từ ví vào ký quỹ?`)) return;
  try { const r = await api(`/escrow/orders/${id}/pay-remainder`, { method: 'POST' }); toast(r.message, 'ok'); render(); } catch (e) { toast(e.message, 'err'); }
}
async function confirmCod(id, amount) {
  if (!confirm(`Bạn đã thực nhận ${fmtVND(amount)} COD? Thao tác được ghi vào lịch sử đơn.`)) return;
  try { const r = await api(`/orders/${id}/confirm-cod`, { method: 'POST' }); toast(r.message, 'ok'); render(); } catch (e) { toast(e.message, 'err'); }
}
async function orderStatus(id, to, extra = {}) {
  const note = to === 'CANCELLED' ? prompt('Lý do huỷ:') : undefined;
  if (to === 'CANCELLED' && note === null) return;
  try { await api(`/orders/${id}/status`, { method: 'PATCH', body: { to, note: note || undefined, ...extra } }); toast('Đã cập nhật đơn hàng', 'ok'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
function shipModal(id) {
  openModal(`<h3 style="margin-bottom:14px">🚚 Gửi hàng</h3><div class="form-row"><label class="lbl">Mã vận đơn</label><input class="input" id="ship-code" placeholder="VD: VN682910482"></div>
  <button class="btn btn-green" style="width:100%" onclick="const trackingCode=document.getElementById('ship-code').value;closeModal();orderStatus(${id},'SHIPPING',{trackingCode:trackingCode||undefined})">Xác nhận</button>`);
}
function disputeModal(orderId) {
  openModal(`<h3 style="margin-bottom:14px">⚠️ Mở tranh chấp</h3>
    <div class="form-row"><label class="lbl">Lý do *</label><select class="input" id="dp-reason"><option>Hàng không đúng mô tả</option><option>Không nhận được hàng</option><option>Hàng lỗi/hỏng</option><option>Người bán không phản hồi</option></select></div>
    <div class="form-row"><label class="lbl" for="dp-files">Ảnh bằng chứng</label><input class="input" id="dp-files" type="file" accept="image/jpeg,image/png,image/webp" multiple onchange="uploadImages(this,'dp-images',5)"><textarea class="input" id="dp-images" placeholder="URL ảnh bằng chứng, mỗi dòng 1 ảnh" rows="2"></textarea></div><div class="form-row"><label class="lbl">Mô tả chi tiết *</label><textarea class="input" id="dp-desc" rows="3" placeholder="Mô tả vấn đề (tối thiểu 10 ký tự)"></textarea></div>
    <button class="btn btn-red" style="width:100%" onclick="doDispute(${orderId})">Gửi khiếu nại</button>`);
}
async function doDispute(orderId) {
  try {
    await api(`/disputes/orders/${orderId}/disputes`, { method: 'POST', body: { reason: $('#dp-reason').value, description: $('#dp-desc').value, evidences: $('#dp-images').value.split('\n').map(s=>s.trim()).filter(Boolean) } });
    closeModal(); toast('Đã mở tranh chấp, admin sẽ xử lý trong 24h', 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}
function reviewModal(orderId) {
  openModal(`<h3 style="margin-bottom:14px">⭐ Đánh giá sau mua</h3><label class="lbl" for="rv-type">Nội dung đánh giá</label><select class="input" id="rv-type"><option value="SELLER">Người bán</option><option value="PRODUCT">Sản phẩm đã mua</option></select>
    <div class="form-row"><label class="lbl">Số sao</label><select class="input" id="rv-star"><option value="5">★★★★★ (5)</option><option value="4">★★★★ (4)</option><option value="3">★★★ (3)</option><option value="2">★★ (2)</option><option value="1">★ (1)</option></select></div>
    <div class="form-row"><label class="lbl">Nhận xét</label><textarea class="input" id="rv-cmt" rows="3"></textarea></div>
    <button class="btn btn-green" style="width:100%" onclick="doReview(${orderId})">Gửi đánh giá</button>`);
}
async function doReview(orderId) {
  try {
    await api(`/reviews/orders/${orderId}/reviews`, { method: 'POST', body: { rating: +$('#rv-star').value, comment: $('#rv-cmt').value, type: $('#rv-type').value } });
    closeModal(); toast('Cảm ơn bạn đã đánh giá!', 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- wallet ---------- */
route('wallet', async () => {
  if (!store.token) { location.hash = '#/login'; return; }
  const [w, txns, banks] = await Promise.all([
    api('/wallet'), api('/wallet/transactions?limit=10'), api('/wallet/banks'),
  ]);
  window._banks = banks;
  const tBadge = { TOPUP: 'p-ok', WITHDRAW: 'p-bad', ORDER_INCOME: 'p-ok', ORDER_PAYMENT: 'p-bad', PLATFORM_FEE: 'p-mut', REFUND: 'p-ok', ADJUSTMENT: 'p-info' };
  $('#app').innerHTML = `<div class="wrap"><h1 style="font-size:23px;margin-bottom:16px">👛 Ví SafePay</h1>
  <div class="card" style="padding:26px;background:linear-gradient(120deg,#0c2413,#1c6b2c);color:#fff;border:0;margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
      <div><div style="opacity:.8;font-size:12.5px">Số dư khả dụng</div><div style="font-size:38px;font-weight:800">${fmtVND(w.balance)}</div><p>Đang giữ cho rút tiền / trả hàng: ${fmtVND(w.pendingBalance)}</p></div>
      <div style="display:flex;gap:8px"><button class="btn" style="background:#fff;color:var(--green-dark)" onclick="topupModal()">＋ Nạp tiền</button><button class="btn btn-line" onclick="withdrawModal()">💸 Rút tiền</button></div>
    </div></div>
  <div class="row2" style="grid-template-columns:1.6fr 1fr;align-items:start">
    <div class="sect" style="padding:0;overflow:hidden"><div style="padding:18px 20px 0"><h2>Lịch sử giao dịch</h2></div>
      <table class="tbl" style="margin-top:12px"><thead><tr><th>Giao dịch</th><th>Số tiền</th><th>Ngày</th></tr></thead><tbody>
      ${txns.data.map((t) => `<tr><td><b>${t.type}</b><div class="muted" style="font-size:11.5px">${esc(t.note || t.reference || '')}</div></td>
        <td style="font-weight:700;color:${t.amount >= 0 ? 'var(--green-dark)' : 'var(--red)'}">${t.amount >= 0 ? '+' : ''}${fmtVND(t.amount)}</td>
        <td class="muted">${fmtDate(t.createdAt)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Chưa có giao dịch.</td></tr>'}</tbody></table></div>
    <div><div class="sect"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2>🏦 Tài khoản ngân hàng</h2><button class="btn btn-line btn-sm" onclick="bankModal()">+ Thêm</button></div>
      ${banks.map((b) => `<div class="card" style="padding:12px 14px;margin-bottom:8px;box-shadow:none;display:flex;gap:10px;align-items:center"><span class="badge b-green">${esc(b.bankName.slice(0, 3).toUpperCase())}</span><div style="flex:1"><b style="font-size:13px">${esc(b.bankName)}</b><div class="muted" style="font-size:11px">**** ${esc(b.accountNumber.slice(-4))}</div></div>${b.isDefault ? '<span class="badge b-blue">Mặc định</span>' : ''}</div>`).join('') || '<p class="muted" style="font-size:13px">Chưa liên kết.</p>'}</div></div>
  </div></div>
  `;
});
function topupModal() {
  openModal(`<h3 style="margin-bottom:14px">＋ Nạp tiền vào ví</h3>
    <div class="form-row"><label class="lbl">Số tiền (đ, tối thiểu 10.000)</label><input class="input" id="tp-amt" type="number" value="100000"></div>
    <button class="btn btn-green" style="width:100%" onclick="doTopup()">Nạp tiền</button>
    <p class="muted" style="font-size:11.5px;margin-top:10px">Demo: tiền được cộng ngay. Thực tế sẽ qua cổng thanh toán.</p>`);
}
async function doTopup() {
  try { const r = await api('/wallet/topup', { method: 'POST', body: { amount: +$('#tp-amt').value, method: 'MOMO_QR' } }); closeModal(); toast(r.message, 'ok'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
function withdrawModal() {
  const banks = window._banks || [];
  if (!banks.length) { toast('Hãy thêm tài khoản ngân hàng trước', 'err'); return; }
  openModal(`<h3 style="margin-bottom:14px">💸 Rút tiền</h3>
    <div class="form-row"><label class="lbl">Số tiền (đ, tối thiểu 50.000)</label><input class="input" id="wd-amt" type="number" value="100000"></div>
    <div class="form-row"><label class="lbl">Về tài khoản</label><select class="input" id="wd-bank">${banks.map((b) => `<option value="${b.id}">${esc(b.bankName)} ****${esc(b.accountNumber.slice(-4))}</option>`).join('')}</select></div>
    <button class="btn btn-green" style="width:100%" onclick="doWithdraw()">Gửi yêu cầu rút</button>`);
}
async function doWithdraw() {
  try { const r = await api('/wallet/withdraw', { method: 'POST', body: { amount: +$('#wd-amt').value, bankAccountId: +$('#wd-bank').value } }); closeModal(); toast(r.message, 'ok'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
function bankModal() {
  openModal(`<h3 style="margin-bottom:14px">🏦 Thêm tài khoản ngân hàng</h3>
    <div class="form-row"><label class="lbl">Ngân hàng *</label><input class="input" id="bk-name" placeholder="VD: Techcombank"></div>
    <div class="form-row"><label class="lbl">Số tài khoản *</label><input class="input" id="bk-num"></div>
    <div class="form-row"><label class="lbl">Tên chủ tài khoản *</label><input class="input" id="bk-holder"></div>
    <button class="btn btn-green" style="width:100%" onclick="doAddBank()">Thêm</button>`);
}
async function doAddBank() {
  try {
    await api('/wallet/banks', { method: 'POST', body: { bankName: $('#bk-name').value, accountNumber: $('#bk-num').value, accountName: $('#bk-holder').value, isDefault: true } });
    closeModal(); toast('Đã thêm tài khoản', 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- profile ---------- */
route('profile', async () => {
  if (!store.token) { location.hash = '#/login'; return; }
  const [me, addrs] = await Promise.all([api('/users/me/profile'), api('/users/me/addresses')]);
  $('#app').innerHTML = `<div class="wrap"><h1 style="font-size:23px;margin-bottom:16px">👤 Hồ sơ cá nhân</h1>
  <div class="row2" style="align-items:start">
    <div class="sect"><h2>Thông tin cá nhân</h2>
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:16px">${avatarHtml(me, 64)}<div><b style="font-size:17px">${esc(me.fullName)}</b><div class="muted" style="font-size:12px">${esc(me.email)}</div>${!me.emailVerifiedAt ? `<button class="btn btn-line btn-sm" onclick="resendVerification()">Gửi lại xác nhận email</button>` : ''}${me.emailVerifiedAt ? '<span class="badge b-blue">✓ Email đã xác nhận</span>' : ''} ${me.idVerified ? '<span class="badge b-green">✓ Danh tính đã duyệt</span>' : ''}</div></div>
      <form onsubmit="return saveProfile(event)">
      <div class="form-row"><label class="lbl">Họ và tên</label><input class="input" id="pf-name" value="${esc(me.fullName)}"></div>
      <div class="form-row"><label class="lbl">Số điện thoại</label><input class="input" id="pf-phone" value="${esc(me.phone || '')}"></div>
      <div class="form-row"><label class="lbl">Giới thiệu</label><textarea class="input" id="pf-bio" rows="2">${esc(me.bio || '')}</textarea></div>
      <button class="btn btn-green">Lưu thay đổi</button></form>
      ${!hasRole('SELLER') ? `<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)"><button class="btn btn-line" onclick="becomeSeller()">🏪 Mở kênh người bán</button></div>` : ''}
    </div>
    <div class="sect"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2>📍 Sổ địa chỉ</h2><button class="btn btn-line btn-sm" onclick="addrModal()">+ Thêm</button></div>
      ${addrs.map((a) => `<div class="card" style="padding:12px 14px;margin-bottom:8px;box-shadow:none"><b style="font-size:13px">${esc(a.receiver)}</b> · ${esc(a.phone)} ${a.isDefault ? '<span class="badge b-blue">Mặc định</span>' : ''}<div class="muted" style="font-size:12px">${esc(a.street)}, ${esc(a.city)}</div></div>`).join('') || '<p class="muted">Chưa có địa chỉ.</p>'}
    </div>
  </div></div>`;
});
async function saveProfile(e) {
  e.preventDefault();
  try { await api('/users/me', { method: 'PATCH', body: { fullName: $('#pf-name').value, phone: $('#pf-phone').value, bio: $('#pf-bio').value } }); toast('Đã lưu!', 'ok'); }
  catch (err) { toast(err.message, 'err'); }
  return false;
}
function addrModal() {
  openModal(`<h3 style="margin-bottom:14px">📍 Thêm địa chỉ</h3>
    <div class="form-row"><label class="lbl">Người nhận *</label><input class="input" id="ad-name"></div>
    <div class="form-row"><label class="lbl">SĐT *</label><input class="input" id="ad-phone"></div>
    <div class="form-row"><label class="lbl">Địa chỉ *</label><input class="input" id="ad-street" placeholder="Số nhà, đường"></div>
    <div class="form-row"><label class="lbl">Tỉnh/Thành *</label><input class="input" id="ad-city" value="Bình Dương"></div>
    <button class="btn btn-green" style="width:100%" onclick="doAddAddr()">Thêm</button>`);
}
async function doAddAddr() {
  try {
    await api('/users/me/addresses', { method: 'POST', body: { label: 'Nhà', receiver: $('#ad-name').value, phone: $('#ad-phone').value, street: $('#ad-street').value, city: $('#ad-city').value, isDefault: true } });
    closeModal(); toast('Đã thêm địa chỉ', 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- chat ---------- */
route('chat', async () => {
  if (!store.token) { location.hash = '#/login'; return; }
  const convs = await api('/chat/conversations');
  $('#app').innerHTML = `<div class="wrap"><h1 style="font-size:23px;margin-bottom:16px">💬 Tin nhắn</h1>
  <div class="row2" style="grid-template-columns:320px 1fr;align-items:start">
    <div class="sect" style="padding:12px">${convs.map((c) => `
      <div class="card" style="padding:12px;margin-bottom:8px;box-shadow:none;cursor:pointer;display:flex;gap:10px;align-items:center" onclick="openThread(${c.user.id},${c.listingId || 'null'})">
        ${avatarHtml(c.user, 40)}<div style="flex:1;min-width:0"><b style="font-size:13px">${esc(c.user.fullName)}</b><div class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.lastMessage)}</div></div>
        ${c.unread ? `<span class="badge b-red">${c.unread}</span>` : ''}</div>`).join('') || '<p class="muted" style="padding:12px">Chưa có hội thoại.</p>'}</div>
    <div class="sect" id="thread"><p class="muted">Chọn một hội thoại để xem.</p></div>
  </div></div>`;
});
let threadUser = null, threadListing = null;
async function openThread(userId, listingId) {
  threadUser = userId; threadListing = listingId;
  const msgs = await api(`/chat/with/${userId}${listingId ? '?listingId=' + listingId : ''}`);
  const u = store.user;
  $('#thread').innerHTML = `<div id="thread-body" style="max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
    ${msgs.map((m) => `<div style="align-self:${m.senderId === u.id ? 'flex-end' : 'flex-start'};max-width:75%;background:${m.senderId === u.id ? 'var(--green)' : '#f1f3f1'};color:${m.senderId === u.id ? '#fff' : 'var(--ink)'};padding:9px 14px;border-radius:14px;font-size:13px">${esc(m.body)}<div style="font-size:10px;opacity:.7;margin-top:2px">${fmtDate(m.createdAt)}</div></div>`).join('') || '<p class="muted">Chưa có tin nhắn. Hãy chào nhau đi! 👋</p>'}</div>
    <div style="display:flex;gap:8px"><input class="input" id="chat-in" placeholder="Nhập tin nhắn..."><button class="btn btn-green" onclick="sendChat()">Gửi</button></div>`;
  const tb = $('#thread-body'); if (tb) tb.scrollTop = tb.scrollHeight;
  const ci = $('#chat-in'); if (ci) ci.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
}
async function sendChat() {
  const body = $('#chat-in').value.trim(); if (!body) return;
  try {
    await api('/chat/messages', { method: 'POST', body: { receiverId: threadUser, body, listingId: threadListing || undefined } });
    openThread(threadUser, threadListing);
  } catch (e) { toast(e.message, 'err'); }
}
async function startChat(sellerId, listingId) {
  if (!store.token) { location.hash = '#/login'; return; }
  if (sellerId === store.user.id) { toast('Đây là tin của bạn', 'err'); return; }
  location.hash = '#/chat';
  setTimeout(() => openThread(sellerId, listingId), 600);
}

/* ---------- notifications ---------- */
route('notifications', async () => {
  if (!store.token) { location.hash = '#/login'; return; }
  const res = await api('/notifications?limit=20');
  $('#app').innerHTML = `<div class="wrap"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h1 style="font-size:23px">🔔 Thông báo (${res.unreadCount} chưa đọc)</h1><button class="btn btn-line btn-sm" onclick="readAllNotif()">Đánh dấu đọc tất cả</button></div>
  ${res.data.map((n) => `<div class="card" style="padding:16px 20px;margin-bottom:10px;box-shadow:none;${n.isRead ? 'opacity:.75' : 'border-left:4px solid var(--green)'};cursor:pointer" onclick="readNotif(${n.id})">
    <b style="font-size:13.5px">${esc(n.title)}</b><div style="font-size:13px;margin-top:4px">${esc(n.body || '')}</div><div class="muted" style="font-size:11px;margin-top:4px">${fmtDate(n.createdAt)}</div>${n.data?.listingId ? `<a class="btn btn-line btn-sm" href="#/listing/${n.data.listingId}" onclick="event.stopPropagation();readNotif(${n.id})">Xem sản phẩm →</a>` : ''}</div>`).join('') || `<div class="empty"><div class="e">🔔</div>Chưa có thông báo.</div>`}</div>`;
});
async function readNotif(id) { await api(`/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {}); render(); updateNotifDot(); }
async function readAllNotif() { await api('/notifications/read-all', { method: 'PATCH' }); render(); updateNotifDot(); }

/* ================= SELLER ================= */
route('seller', async (tab) => {
  if (!store.token) { location.hash = '#/login'; return; }
  if (!hasRole('SELLER')) { $('#app').innerHTML=`<div class="wrap"><section class="seller-onboarding sect"><div class="onboarding-icon">${uiIcon('shop')}</div><h1>Mở gian hàng của bạn</h1><p class="muted">Đăng món đồ còn tốt, trao đổi với người mua và quản lý đơn hàng tại một nơi.</p><button class="btn btn-green" onclick="becomeSeller()">${uiIcon('plus')} Bắt đầu bán hàng</button><a class="btn btn-line" href="#/">Tiếp tục mua sắm</a></section></div>`;return; }
  tab = tab || 'dashboard';
  const d = await api('/seller/dashboard');
  const nav = [['dashboard', '📊 Tổng quan'], ['listings', '📦 Tin đăng'], ['new', '＋ Đăng tin mới'], ['offers', '💬 Trả giá'], ['insights', '⭐ Phân tích đánh giá'], ['orders', '🧾 Đơn bán']];
  let body = '';
  if (tab === 'dashboard') {
    body = `<div class="stat-grid">
      <div class="stat"><div class="t">Thu ròng ví 7 ngày (không gồm COD)</div><div class="v" style="color:var(--green-dark)">${fmtVND(d.kpis.weeklyRevenue)}</div></div>
      <div class="stat"><div class="t">Đơn chờ xử lý</div><div class="v">${d.kpis.pendingOrders}</div></div>
      <div class="stat"><div class="t">Tổng lượt xem</div><div class="v">${d.kpis.totalViews}</div></div>
      <div class="stat"><div class="t">Tin đang bán</div><div class="v">${(d.listingStatus.find((s) => s.status === 'ACTIVE') || {})._count || 0}</div></div></div>
      <div class="stat-grid"><div class="stat"><div class="t">Tổng giá trị đơn đang thực hiện/hoàn tất</div><div class="v">${fmtVND(d.kpis.orderValue)}</div></div><div class="stat"><div class="t">Tiền đang giữ trong ký quỹ</div><div class="v">${fmtVND(d.kpis.escrowHeld)}</div></div></div><div class="row2" style="align-items:start"><div class="sect"><h2>🧾 Đơn bán gần đây</h2>
      ${d.recentOrders.map((o) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f3f1;font-size:13px;cursor:pointer" onclick="location.hash='#/orders/${o.id}'"><span><b>#${esc(o.code)}</b> ${stPill(o.status)}</span><b>${fmtVND(o.totalAmount)}</b></div>`).join('') || '<p class="muted">Chưa có.</p>'}</div>
      <div class="sect"><h2>🔥 Sản phẩm nổi bật</h2>
      ${d.topProducts.map((l) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f3f1;font-size:13px"><span>${esc(l.title)}</span><span class="muted">👁 ${l.views} · 🧾 ${l.orders} đơn</span></div>`).join('') || '<p class="muted">Chưa có.</p>'}</div></div>`;
  } else if (tab === 'listings') {
    const page = new URLSearchParams(location.hash.split('?')[1] || '').get('page') || 1;
    const res = await api('/seller/listings?limit=20&page=' + encodeURIComponent(page));
    const rows = Array.isArray(res) ? res : (res.data || []);
    body = `<div class="sect" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr><th>Tin đăng</th><th>Giá</th><th>Trạng thái</th><th>Lượt xem</th><th></th></tr></thead><tbody>
      ${rows.map((l) => `<tr><td><div style="display:flex;gap:10px;align-items:center"><img src="${img(l.images?.[0]?.url)}" style="width:56px;height:44px;object-fit:cover;border-radius:8px" onerror="this.src='${IMG_PH}'"><b>${esc(l.title)}</b></div></td>
        <td><b>${fmtVND(l.price)}</b></td><td><span class="pill ${l.status === 'ACTIVE' ? 'p-ok' : 'p-mut'}">${LISTING_STATUS_NAMES[l.status] || l.status}</span></td><td>${l.views || 0}</td>
        <td style="white-space:nowrap"><button class="btn btn-line btn-sm" onclick="previewListing(${l.id})">Xem trước</button>${!['RESERVED','SOLD_OUT','DELETED'].includes(l.status) ? `<a class="btn btn-line btn-sm" href="#/edit-listing/${l.id}">Sửa</a>` : ''}
        ${['ACTIVE', 'HIDDEN'].includes(l.status) ? `<button class="btn btn-line btn-sm" onclick="toggleVis(${l.id},'${l.status}')">${l.status === 'ACTIVE' ? 'Ẩn' : 'Hiện'}</button>` : ''}
        <button class="btn btn-line btn-sm" onclick="boostListing(${l.id})" title="Đẩy tin 5.000đ/ngày">⚡ Đẩy</button>
        <button class="btn btn-line btn-sm" style="color:var(--red)" onclick="delListing(${l.id})">Xoá</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Chưa có tin nào.</td></tr>'}</tbody></table></div>${pagination(res.meta, 'sellerListingsPage')}`;
  } else if (tab === 'new') {
    body = `<div class="sect" style="max-width:640px"><h2>＋ Đăng tin mới</h2><form onsubmit="return submitListing(event)">
      <div class="form-row"><label class="lbl">Tiêu đề * (tối thiểu 10 ký tự)</label><input class="input" id="nl-title" required minlength="10" maxlength="80" placeholder="VD: Tai nghe Sony WH-1000XM4 99%"></div>
      <div class="row2"><div class="form-row"><label class="lbl">Danh mục *</label><select class="input" id="nl-cat" onchange="renderSpecificationFields()">${categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-row"><label class="lbl">Tình trạng *</label><select class="input" id="nl-cond"><option value="NEW">Mới</option><option value="LIKE_NEW">Như mới</option><option value="USED_GOOD" selected>Tốt</option><option value="USED_FAIR">Khá</option><option value="FOR_PARTS">Linh kiện</option></select></div></div>
      <div class="row2"><div class="form-row"><label class="lbl">Giá bán (đ) *</label><input class="input" id="nl-price" type="number" required min="0"></div>
      <div class="form-row"><label class="lbl" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="nl-free" style="accent-color:var(--green)" onchange="document.querySelector('#nl-price').disabled=this.checked;if(this.checked)document.querySelector('#nl-price').value=0"> 🎁 Cho tặng 0đ (miễn phí)</label></div></div>
      <div class="form-row"><label class="lbl" for="nl-files">Ảnh sản phẩm * (chụp/chọn từ máy, tối thiểu 1 ảnh)</label><input class="input" id="nl-files" type="file" accept="image/jpeg,image/png,image/webp" multiple onchange="uploadImages(this,'nl-imgs')"><div id="nl-preview" class="evidence-grid" style="margin:8px 0 0"></div><details style="margin-top:8px"><summary class="muted" style="font-size:12.5px;cursor:pointer">Hoặc dán link ảnh (mỗi dòng 1 link)</summary><textarea class="input" id="nl-imgs" rows="2" placeholder="https://..." oninput="renderNlPreviews()"></textarea></details></div>
      <div class="form-row"><label class="lbl">Mô tả *</label><textarea class="input" id="nl-desc" rows="4" required minlength="20" placeholder="Gợi ý: tình trạng thực tế + lỗi (nếu có) + phụ kiện kèm theo + lý do bán..."></textarea></div>
      <div class="form-row"><label class="lbl" for="nl-city">Tỉnh / thành phố</label><input class="input" id="nl-city"></div><div class="form-row"><label class="lbl" for="nl-delivery">Hình thức giao nhận</label><select class="input" id="nl-delivery"><option value="ANY">Gặp trực tiếp hoặc giao hàng</option><option value="MEETUP">Chỉ gặp trực tiếp</option><option value="DELIVERY">Giao hàng</option></select></div><div id="nl-specs"></div><button class="btn btn-line" type="button" onclick="previewListingForm()">Xem trước</button><button class="btn btn-green" style="width:100%">Đăng tin (chờ duyệt)</button></form></div>`;
  } else if (tab === 'orders') {
    const page = new URLSearchParams(location.hash.split('?')[1] || '').get('page') || 1;
    const res = await api('/orders/sales?limit=20&page=' + encodeURIComponent(page));
    body = res.data.map((o) => `<div class="card" style="padding:16px 20px;margin-bottom:12px;display:flex;gap:16px;align-items:center;cursor:pointer" onclick="location.hash='#/orders/${o.id}'">
      <div style="flex:1"><b>#${esc(o.code)}</b> ${stPill(o.status)}<div style="font-size:13px;margin-top:4px">${esc(o.listing.title)} · Buyer: ${esc(o.buyer.fullName)}</div></div>
      <b style="color:var(--green-dark)">${fmtVND(o.totalAmount)}</b></div>`).join('') || '<p class="muted">Chưa có đơn nào.</p>';
    body += pagination(res.meta, 'sellerOrdersPage');
  }
  if (tab === 'dashboard') body += sellerChartHTML();
  $('#app').innerHTML = `<div class="wrap seller-shell"><header class="seller-header"><div><h1>Kênh người bán</h1><p>Chào ${esc(store.user.fullName)}. Quản lý gian hàng của bạn tại đây.</p></div><a class="btn btn-green btn-sm" href="#/seller/new">${uiIcon('plus')} Đăng tin mới</a></header>
    <nav class="seller-navigation" aria-label="Kênh người bán">${nav.map(([t,l])=>`<a href="#/seller/${t}" ${tab===t?'aria-current="page"':''}>${uiIcon(navigationIcon(t))}${esc(cleanLabel(l))}</a>`).join('')}<a href="#/returns">${uiIcon('return')} Trả hàng</a><a href="#/shop/${store.user.id}">${uiIcon('shop')} Xem gian hàng</a></nav>
    <div id="seller-content">${body}</div></div>`;
  if (tab === 'dashboard') setTimeout(sellerChartReload, 50);
  if (tab === 'new') await renderSpecificationFields();
  if (tab === 'new') {
    renderNlPreviews();
    try {
      const addrs = await api('/users/me/addresses');
      const list = Array.isArray(addrs) ? addrs : addrs.data || [];
      const def = list.find(a => a.isDefault) || list[0];
      if (def?.city && $('#nl-city') && !$('#nl-city').value) $('#nl-city').value = def.city;
    } catch { /* Có địa chỉ hay không vẫn đăng tin được. */ }
  }
  if (tab === 'offers') await sellerOffers();
  if (tab === 'insights') await renderReviewInsights($('#seller-content'));
});
async function toggleVis(id, cur) {
  try { await api(`/listings/${id}/visibility`, { method: 'PATCH', body: { status: cur === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE' } }); toast('Đã cập nhật', 'ok'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
async function delListing(id) {
  if (!confirm('Xoá tin này?')) return;
  try { await api('/listings/' + id, { method: 'DELETE' }); toast('Đã xoá', 'ok'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
async function boostListing(id) {
  try { const r = await api(`/listings/${id}/boost`, { method: 'POST', body: { days: 1 } }); toast(r.message, 'ok'); }
  catch (e) { toast(e.message, 'err'); }
}
async function submitListing(e) {
  e.preventDefault();
  const imgs = nlImageUrls();
  if (!imgs.length) { toast('Thêm ít nhất 1 ảnh sản phẩm', 'err'); return false; }
  try {
    const l = await api('/listings', { method: 'POST', body: {
      categoryId: +$('#nl-cat').value, title: $('#nl-title').value, description: $('#nl-desc').value,
      price: +$('#nl-price').value, condition: $('#nl-cond').value, isFree: $('#nl-free').checked,
      images: imgs, city: $('#nl-city').value.trim(), deliveryMethod: $('#nl-delivery').value, specifications: listingSpecifications(),
    }});
    toast('Đăng tin thành công, đang chờ duyệt!', 'ok'); location.hash = '#/seller/listings';
  } catch (err) { toast(err.message, 'err'); }
  return false;
}

/* ================= ADMIN ================= */
const ADMIN_TABS = {
  finance: [['overview', '📊 Tổng quan'], ['charts', '📈 Thống kê'], ['orders', '🧾 Đơn hàng'], ['transactions', '💳 Giao dịch'], ['disputes', '⚖️ Tranh chấp'], ['fees', '💰 Phí dịch vụ']],
  content: [['pending', '📝 Tin chờ duyệt'], ['reports', '🚩 Báo cáo'], ['promos', '🎟️ Khuyến mãi'], ['banners', '🖼️ Banner'], ['users', '👥 Người dùng']],
};
route('admin', async (tab) => {
  if (!store.token || !hasRole('ADMIN_FINANCE', 'ADMIN_CONTENT')) { location.hash = '#/'; return; }
  const isFin = hasRole('ADMIN_FINANCE'), isCon = hasRole('ADMIN_CONTENT');
  const role = isCon && ADMIN_TABS.content.some(([key]) => key === tab) ? 'content' : isFin ? 'finance' : 'content';
  const tabs = ADMIN_TABS[role].filter(([key])=>key !== 'permissions' || store.user.canManageRoles);
  tab = tabs.some(([key]) => key === tab) ? tab : tabs[0][0];
  let body = '<div class="empty">⏳</div>';
  const title = cleanLabel(tabs.find(([key]) => key === tab)[1]);
  const roleName = role === 'finance' ? 'Tài chính' : 'Nội dung';
  const nav = tabs.map(([t, l]) => `<a class="anav ${tab === t ? 'on' : ''}" href="#/admin/${t}" ${tab === t ? 'aria-current="page"' : ''}>${uiIcon(navigationIcon(t))}<span>${esc(cleanLabel(l))}</span></a>`).join('');
  document.title = `${title} — Quản trị Nola2Hand`;
  $('#app').innerHTML = `<div class="alayout">
    <aside class="aside"><a class="logo admin-logo" href="#/admin"><span class="brand-mark">${uiIcon('cycle')}</span><span><span class="g">nola</span>2hand</span></a><span class="arole ${role}">${role === 'finance' ? 'Quản trị tài chính' : 'Quản trị nội dung'}</span>
    <div class="admin-nav-label">Không gian làm việc</div><nav aria-label="Quản trị ${roleName}">${nav}</nav><div class="admin-nav-label">Tài khoản</div><a class="anav" href="#/profile">${uiIcon('user')} Hồ sơ của tôi</a><a class="anav" href="#/">${uiIcon('home')} Về trang mua sắm</a>
    <div class="admin-usercard">${avatarHtml(store.user, 36)}<div><b>${esc(store.user.fullName)}</b><span>Quản trị ${roleName.toLocaleLowerCase('vi')}</span></div><button onclick="logout()" aria-label="Đăng xuất" title="Đăng xuất">↪</button></div></aside>
    <div class="admin-main"><header class="admin-topbar"><div><p>Không gian quản trị / ${roleName}</p><h1>${esc(title)}</h1></div><div class="admin-top-actions">${isFin && isCon ? `<nav class="admin-role-switch" aria-label="Chọn vai trò quản trị"><a class="${role === 'finance' ? 'on' : ''}" href="#/admin/overview">Tài chính</a><a class="${role === 'content' ? 'on' : ''}" href="#/admin/pending">Nội dung</a></nav>` : ''}<a class="hact" href="#/notifications" aria-label="Thông báo">${uiIcon('bell')}</a><a href="#/profile" aria-label="Hồ sơ cá nhân">${avatarHtml(store.user, 36)}</a></div></header><div class="abody" id="abody">${body}</div></div></div>`;
  try { await ADMIN_VIEWS[role + ':' + tab](); } catch (e) { $('#abody').innerHTML = `<div class="empty"><div class="e">⚠️</div>${esc(e.message)}</div>`; }
});
const ADMIN_VIEWS = {
  'finance:overview': async () => {
    const d = await api('/admin/finance/overview');
    const k = d.kpis || {};
    $('#abody').innerHTML = `<h2 style="margin-bottom:16px">📊 Tổng quan tài chính</h2><div class="stat-grid">
      <div class="stat"><div class="t">Doanh thu tháng này</div><div class="v" style="color:var(--green-dark)">${fmtVND(k.monthlyRevenue)}</div></div>
      <div class="stat"><div class="t">Tổng giao dịch ví</div><div class="v">${k.totalTransactions || 0}</div></div>
      <div class="stat"><div class="t">Hoàn tiền chờ duyệt</div><div class="v" style="color:var(--amber)">${k.pendingRefunds || 0}</div></div>
      <div class="stat"><div class="t">Tranh chấp đang mở</div><div class="v" style="color:var(--red)">${k.openDisputes || 0}</div></div></div>
      <div class="row2" style="align-items:start"><div class="sect"><h2>💳 Giao dịch gần đây</h2>
      ${(d.recentTransactions || []).slice(0, 5).map((t) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f3f1;font-size:13px"><span><b>${TXN_TYPE_NAMES[t.type] || t.type}</b> <span class="muted">#${t.id}</span></span><b style="color:${t.amount >= 0 ? 'var(--green-dark)' : 'var(--red)'}">${fmtVND(t.amount)}</b></div>`).join('') || '<p class="muted">Chưa có.</p>'}</div>
      <div class="sect"><h2>⚖️ Tranh chấp gần đây</h2>
      ${(d.recentDisputes || []).slice(0, 5).map((x) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f3f1;font-size:13px;cursor:pointer" onclick="location.hash='#/admin/disputes'"><span><b>${esc(x.code)}</b> ${esc(x.reason || '')}</span><span class="pill p-bad">${DISPUTE_STATUS_NAMES[x.status] || x.status}</span></div>`).join('') || '<p class="muted">Không có.</p>'}</div></div>`;
  },
  'finance:transactions': async () => {
    const d = await api('/admin/finance/transactions?limit=30');
    $('#abody').innerHTML = `<h2 style="margin-bottom:16px">💳 Giao dịch ví</h2><div class="tblwrap"><table class="tbl"><thead><tr><th>ID</th><th>Loại</th><th>Số tiền</th><th>Tham chiếu</th><th>Ngày</th></tr></thead><tbody>
      ${d.data.map((t) => `<tr><td class="muted">#${t.id}</td><td><b>${TXN_TYPE_NAMES[t.type] || t.type}</b></td><td style="font-weight:700;color:${t.amount >= 0 ? 'var(--green-dark)' : 'var(--red)'}">${fmtVND(t.amount)}</td><td class="muted">${esc(t.reference || '')}</td><td class="muted">${fmtDate(t.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
  },
  'finance:disputes': async () => {
    const d = await api('/disputes/admin/all?status=OPEN');
    $('#abody').innerHTML = `<h2 style="margin-bottom:16px">⚖️ Tranh chấp đang mở (${d.data.length})</h2>
      ${d.data.map((x) => `<div class="sect"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Đơn #${esc(x.order.code)} — ${esc(x.reason)}</b><span class="pill p-bad">${DISPUTE_STATUS_NAMES[x.status] || x.status}</span></div>
        <p style="font-size:13px">${esc(x.description)}</p><p class="muted" style="font-size:12px;margin:8px 0">Buyer: ${esc(x.buyer?.fullName || '')} · Seller: ${esc(x.seller?.fullName || '')} · ${fmtDate(x.createdAt)}</p>
        <div style="display:flex;gap:8px"><button class="btn btn-green btn-sm" onclick="resolveDispute(${x.id},'BUYER_WINS')">Hoàn tiền cho buyer</button><button class="btn btn-dark btn-sm" onclick="resolveDispute(${x.id},'SELLER_WINS')">Giải ngân cho seller</button><button class="btn btn-line btn-sm" onclick="resolveDispute(${x.id},'SPLIT')">Chia đôi</button></div></div>`).join('') || '<p class="muted">Không có tranh chấp nào.</p>'}`;
  },
  'finance:orders': async () => {
    const d = await api('/orders/admin/all?limit=30');
    $('#abody').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px"><h2>🧾 Quản lý đơn hàng (${d.meta.total})</h2>
      <div class="toolbar" style="margin:0"><select class="input" id="ao-status" onchange="adminOrdersReload()">
        <option value="">Tất cả trạng thái</option>
        ${Object.keys(ORDER_ST).map((s) => `<option value="${s}">${ORDER_ST[s][0]}</option>`).join('')}
      </select><input class="input" id="ao-q" placeholder="Tìm mã đơn..." style="min-width:150px"><button class="btn btn-line btn-sm" onclick="adminOrdersReload()">Tìm</button></div></div>
      <div id="ao-table"></div>`;
    adminOrdersReload();
  },
  'finance:fees': async () => {
    const d = await api('/admin/finance/fees');
    $('#abody').innerHTML = `<h2 style="margin-bottom:16px">💰 Phí dịch vụ</h2><div class="tblwrap"><table class="tbl"><thead><tr><th>Tên phí</th><th>Giá trị</th><th>Mô tả</th><th>Trạng thái</th></tr></thead><tbody>
      ${d.map((f) => `<tr><td><b>${esc(f.name)}</b><div class="muted" style="font-size:11px">${esc(FEE_KIND_NAMES[f.kind] || f.kind)}</div></td><td><b>${f.percent != null ? f.percent + '%' : fmtVND(f.amount)}</b>${f.minAmount != null ? `<div class="muted" style="font-size:11px">Tối thiểu ${fmtVND(f.minAmount)}</div>` : ''}</td><td class="muted">${esc(f.condition || '')}</td><td>${f.isActive ? '<span class="pill p-ok">Đang áp dụng</span>' : '<span class="pill p-mut">Tắt</span>'}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted" style="font-size:12px;margin-top:10px">* Quản lý phí chi tiết qua API (POST /admin/finance/fees). Mặc định: phí giao dịch 5%, phí đẩy tin 5.000đ/ngày.</p>`;
  },
  'content:pending': async () => {
    const d = await api('/listings/admin/pending');
    $('#abody').innerHTML = `<h2 style="margin-bottom:16px">📝 Tin chờ duyệt (${d.data.length})</h2>
      ${d.data.map((l) => `<div class="sect"><div style="display:flex;gap:14px"><img src="${img(l.images?.[0]?.url)}" style="width:120px;height:90px;object-fit:cover;border-radius:10px" onerror="this.src='${IMG_PH}'">
        <div style="flex:1"><b>${esc(l.title)}</b><div class="muted" style="font-size:12px">${esc(l.seller?.fullName || '')} · ${fmtVND(l.price)} · ${fmtDate(l.createdAt)}</div>
        <p style="font-size:13px;margin-top:6px">${esc((l.description || '').slice(0, 200))}...</p></div></div>
        <div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-green btn-sm" onclick="moderate(${l.id},'APPROVE')">✅ Duyệt</button><button class="btn btn-line btn-sm" style="color:var(--red)" onclick="moderate(${l.id},'REJECT')">❌ Từ chối</button></div></div>`).join('') || '<p class="muted">Không có tin chờ duyệt. 🎉</p>'}`;
  },
  'content:reports': async () => {
    const d = await api('/reports/admin/all?status=NEW');
    $('#abody').innerHTML = `<h2 style="margin-bottom:16px">🚩 Báo cáo vi phạm (${d.data.length})</h2>
      ${d.data.map((r) => `<div class="sect"><b>${esc(r.reason)}</b> <span class="pill p-bad">${REPORT_STATUS_NAMES[r.status] || r.status}</span>
        <p style="font-size:13px;margin:8px 0">${esc(r.description || '')}</p><p class="muted" style="font-size:12px">Người báo cáo: ${esc(r.reporter?.fullName || '')} · ${fmtDate(r.createdAt)}</p>
        <div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-green btn-sm" onclick="handleReport(${r.id},'RESOLVED')">Đã xử lý</button><button class="btn btn-line btn-sm" onclick="handleReport(${r.id},'DISMISSED')">Bỏ qua</button></div></div>`).join('') || '<p class="muted">Không có báo cáo nào.</p>'}`;
  },
  'content:promos': async () => {
    const d0 = await api('/promos/admin/all');
    const d = Array.isArray(d0) ? d0 : (d0.data || []);
    $('#abody').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h2>🎟️ Khuyến mãi</h2><button class="btn btn-green btn-sm" onclick="promoModal()">+ Tạo mới</button></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Mã</th><th>Tên</th><th>Giảm</th><th>Hiệu lực</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${d.map((p) => `<tr><td><b style="font-family:monospace">${esc(p.code)}</b></td><td>${esc(p.name)}</td><td><b>${p.discountType === 'PERCENT' ? p.discountValue + '%' : fmtVND(p.discountValue)}</b></td><td class="muted" style="font-size:11.5px">${fmtDate(p.startsAt)} → ${fmtDate(p.endsAt)}</td><td>${p.status === 'ACTIVE' ? '<span class="pill p-ok">Đang chạy</span>' : `<span class="pill p-mut">${PROMO_STATUS_NAMES[p.status] || p.status}</span>`}</td><td><button class="btn btn-line btn-sm" style="color:var(--red)" onclick="delPromo(${p.id})">Xoá</button></td></tr>`).join('')}</tbody></table></div>`;
  },
  'content:banners': async () => {
    const d0 = await api('/banners/admin/all');
    const d = Array.isArray(d0) ? d0 : (d0.data || []);
    $('#abody').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h2>🖼️ Banner</h2><button class="btn btn-green btn-sm" onclick="bannerModal()">+ Tạo mới</button></div>
      ${d.map((b) => `<div class="sect" style="display:flex;gap:14px;align-items:center"><img src="${img(b.imageUrl)}" style="width:160px;height:70px;object-fit:cover;border-radius:8px" onerror="this.src='${IMG_PH}'">
        <div style="flex:1"><b>${esc(b.title)}</b><div class="muted" style="font-size:12px">${esc(b.position)} · ${b.status === 'ACTIVE' ? 'Đang hiển thị' : b.status}</div></div>
        <button class="btn btn-line btn-sm" style="color:var(--red)" onclick="delBanner(${b.id})">Xoá</button></div>`).join('') || '<p class="muted">Chưa có banner.</p>'}`;
  },
  'content:users': async () => {
    const d = await api('/admin/users?limit=30');
    $('#abody').innerHTML = `<h2 style="margin-bottom:16px">👥 Người dùng (${d.meta.total})</h2><div class="tblwrap"><table class="tbl"><thead><tr><th>Người dùng</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${d.data.map((u) => `<tr><td><div style="display:flex;gap:10px;align-items:center">${avatarHtml(u, 32)}<b>${esc(u.fullName)}</b></div></td><td class="muted">${esc(u.email)}</td>
        <td>${u.roles.map((r) => `<span class="pill p-info" style="margin-right:4px">${ROLE_NAMES[r] || r}</span>`).join('')}</td>
        <td>${u.status === 'BANNED' ? '<span class="pill p-bad">Đã khoá</span>' : `<span class="pill ${u.status === 'ACTIVE' ? 'p-ok' : 'p-warn'}">${esc(USER_STATUS_NAMES[u.status] || u.status)}</span>`}</td>
        <td style="white-space:nowrap">${u.status === 'BANNED' ? `<button class="btn btn-green btn-sm" onclick="userLock(${u.id},'unlock')">Mở khoá</button>` : `<button class="btn btn-line btn-sm" style="color:var(--red)" onclick="userLock(${u.id},'lock')">Khoá</button>`}</td></tr>`).join('')}</tbody></table></div>`;
  },
};
async function moderate(id, action) {
  const reason = action === 'REJECT' ? prompt('Lý do từ chối:') : undefined;
  if (action === 'REJECT' && reason === null) return;
  try { await api(`/listings/admin/${id}/moderate`, { method: 'PATCH', body: { action, reason: reason || undefined } }); toast('Đã xử lý', 'ok'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
async function handleReport(id, status) {
  try { await api(`/reports/admin/${id}`, { method: 'PATCH', body: { status, resolution: status === 'RESOLVED' ? 'Đã xử lý' : 'Không vi phạm' } }); toast('Đã cập nhật', 'ok'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
async function resolveDispute(id, decision) {
  const resolution = prompt('Ghi lý do và bằng chứng cho quyết định xử lý:');
  if (!resolution?.trim()) return;
  try { await api(`/disputes/admin/${id}/resolve`, { method: 'PATCH', body: { decision, resolution: resolution.trim() } }); toast('Đã xử lý tranh chấp', 'ok'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
async function userLock(id, act) {
  let reason = 'Mở khoá bởi admin';
  if (act === 'lock') {
    reason = prompt('Lý do khoá tài khoản:');
    if (!reason) return;
  }
  try { await api(`/admin/users/${id}/${act}`, { method: 'PATCH', body: { reason } }); toast('Đã cập nhật', 'ok'); render(); }
  catch (e) { toast(e.message, 'err'); }
}
function promoModal() {
  const today = new Date().toISOString().slice(0, 10);
  const plus30 = new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10);
  openModal(`<h3 style="margin-bottom:14px">🎟️ Tạo khuyến mãi</h3>
    <div class="form-row"><label class="lbl">Mã *</label><input class="input" id="pm-code" placeholder="VD: GIAM10K"></div>
    <div class="form-row"><label class="lbl">Tên *</label><input class="input" id="pm-name"></div>
    <div class="row2"><div class="form-row"><label class="lbl">Loại KM</label><select class="input" id="pm-kind"><option value="VOUCHER">Voucher giảm giá</option><option value="FREESHIP">Miễn phí ship</option><option value="PLATFORM_FEE_DISCOUNT">Giảm phí sàn</option></select></div>
    <div class="form-row"><label class="lbl">Kiểu giảm</label><select class="input" id="pm-type"><option value="AMOUNT">Giảm tiền (đ)</option><option value="PERCENT">Giảm %</option></select></div></div>
    <div class="row2"><div class="form-row"><label class="lbl">Giá trị *</label><input class="input" id="pm-val" type="number" value="10000"></div>
    <div class="form-row"><label class="lbl">Đơn tối thiểu (đ)</label><input class="input" id="pm-min" type="number" value="0"></div></div>
    <div class="row2"><div class="form-row"><label class="lbl">Từ ngày</label><input class="input" id="pm-from" type="date" value="${today}"></div>
    <div class="form-row"><label class="lbl">Đến ngày</label><input class="input" id="pm-to" type="date" value="${plus30}"></div></div>
    <button class="btn btn-green" style="width:100%" onclick="doPromo()">Tạo & kích hoạt</button>`);
}
async function doPromo() {
  try {
    await api('/promos/admin', { method: 'POST', body: {
      code: $('#pm-code').value || undefined, name: $('#pm-name').value, type: $('#pm-kind').value,
      discountType: $('#pm-type').value, discountValue: +$('#pm-val').value, minOrder: +$('#pm-min').value || 0,
      startsAt: new Date($('#pm-from').value).toISOString(), endsAt: new Date($('#pm-to').value).toISOString(),
      status: 'ACTIVE',
    }});
    closeModal(); toast('Đã tạo khuyến mãi', 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function delPromo(id) { if (!confirm('Xoá?')) return; try { await api('/promos/admin/' + id, { method: 'DELETE' }); toast('Đã xoá', 'ok'); render(); } catch (e) { toast(e.message, 'err'); } }
function bannerModal() {
  const today = new Date().toISOString().slice(0, 10);
  const plus30 = new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10);
  openModal(`<h3 style="margin-bottom:14px">🖼️ Tạo banner</h3>
    <div class="form-row"><label class="lbl">Tiêu đề *</label><input class="input" id="bn-title"></div>
    <div class="form-row"><label class="lbl">URL ảnh *</label><input class="input" id="bn-img" placeholder="https://..."></div>
    <div class="form-row"><label class="lbl">Vị trí</label><select class="input" id="bn-pos"><option value="HOME_HERO">Trang chủ (hero)</option><option value="HOME_SECONDARY">Trang chủ (phụ)</option><option value="CATEGORY">Đầu trang danh mục</option></select></div>
    <div class="row2"><div class="form-row"><label class="lbl">Từ ngày</label><input class="input" id="bn-from" type="date" value="${today}"></div>
    <div class="form-row"><label class="lbl">Đến ngày</label><input class="input" id="bn-to" type="date" value="${plus30}"></div></div>
    <button class="btn btn-green" style="width:100%" onclick="doBanner()">Tạo & kích hoạt</button>`);
}
async function doBanner() {
  try {
    await api('/banners/admin', { method: 'POST', body: {
      title: $('#bn-title').value, imageUrl: $('#bn-img').value, position: $('#bn-pos').value,
      startsAt: new Date($('#bn-from').value).toISOString(), endsAt: new Date($('#bn-to').value).toISOString(),
      status: 'ACTIVE',
    }});
    closeModal(); toast('Đã tạo banner', 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function delBanner(id) { if (!confirm('Xoá?')) return; try { await api('/banners/admin/' + id, { method: 'DELETE' }); toast('Đã xoá', 'ok'); render(); } catch (e) { toast(e.message, 'err'); } }

/* ================= BOOT ================= */
(async function boot() {
  const config = await api('/auth/config', { auth: false }).catch(() => ({}));
  GOOGLE_CLIENT_ID = config.googleClientId || '';
  renderFooter();
  await loadCategories();
  renderFooter();
  if (!location.hash) location.hash = '#/'; // hashchange sẽ gọi render()
  else await render();
})();

/* ================= GIỎ HÀNG ================= */
async function updateCartDot() {
  const dot = $('#cart-dot');
  if (!dot) return;
  if (!store.token) { dot.style.display = 'none'; return; }
  try {
    const c = await api('/cart');
    dot.style.display = c.count > 0 ? 'flex' : 'none';
    dot.textContent = c.count > 99 ? '99+' : c.count;
  } catch { dot.style.display = 'none'; }
}
async function addToCart(listingId) {
  if (!store.token) { location.hash = '#/login'; return; }
  try {
    const r = await api('/cart', { method: 'POST', body: { listingId } });
    toast(r.message + ' 🛒', 'ok');
    updateCartDot();
  } catch (e) { toast(e.message, 'err'); }
}
async function removeFromCart(listingId) {
  try { await api('/cart/' + listingId, { method: 'DELETE' }); toast('Đã xoá khỏi giỏ', 'ok'); updateCartDot(); render(); }
  catch (e) { toast(e.message, 'err'); }
}
async function clearCart() {
  if (!confirm('Xoá toàn bộ giỏ hàng?')) return;
  try { await api('/cart', { method: 'DELETE' }); updateCartDot(); render(); }
  catch (e) { toast(e.message, 'err'); }
}
route('cart', async () => {
  if (!store.token) { location.hash = '#/login'; return; }
  const cart = await api('/cart');
  $('#app').innerHTML = `<div class="wrap"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h1 style="font-size:23px">🛒 Giỏ hàng (${cart.count})</h1>
    ${cart.count ? `<button class="btn btn-line btn-sm" onclick="clearCart()">Xoá tất cả</button>` : ''}</div>
  ${cart.items.length ? `<div class="row2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>
    ${cart.items.map((it) => { const l = it.listing; return `
    <div class="card" style="padding:16px;margin-bottom:12px;display:flex;gap:14px;align-items:center">
      <img src="${img(l.images?.[0]?.url)}" style="width:110px;height:88px;object-fit:cover;border-radius:10px;cursor:pointer" onclick="location.hash='#/listing/${l.id}'" onerror="this.src='${IMG_PH}'">
      <div style="flex:1;min-width:0"><b style="cursor:pointer" onclick="location.hash='#/listing/${l.id}'">${esc(l.title)}</b>
        <div class="muted" style="font-size:12px">${esc(l.seller?.fullName || '')} · ${esc(l.category?.name || '')}</div>
        <div style="margin-top:6px;font-weight:800;color:var(--green-dark);font-size:16px">${l.isFree ? '🎁 0đ' : fmtVND(l.price)}</div></div>
      <button class="btn btn-line btn-sm" style="color:var(--red)" onclick="removeFromCart(${l.id})">✕ Xoá</button>
    </div>`; }).join('')}</div>
    <div class="card" style="padding:22px;position:sticky;top:90px"><h3 style="margin-bottom:14px">Tổng đơn hàng</h3>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span class="muted">Tạm tính (${cart.count} món)</span><b>${fmtVND(cart.total)}</b></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:16px"><span class="muted">Phí ship (tính khi đặt)</span><b>~15.000đ/món</b></div>
      <button class="btn btn-green" style="width:100%;padding:14px" onclick="checkoutModal()">💳 Đặt hàng (${cart.count} món)</button>
      <p class="muted" style="font-size:11.5px;margin-top:10px">Mỗi tin sẽ tạo 1 đơn riêng (khác người bán). Thanh toán cọc qua SafePay sau khi đặt.</p>
    </div></div>`
  : `<div class="empty"><div class="e">🛒</div><p>Giỏ hàng trống.</p><br><a class="btn btn-green" href="#/">Tiếp tục mua sắm</a></div>`}</div>`;
});
function checkoutModal() {
  openModal(`<h3 style="margin-bottom:16px">💳 Xác nhận đặt hàng</h3>
    <div class="form-row"><label class="lbl">Người nhận *</label><input class="input" id="co-name" value="${esc(store.user.fullName)}"></div>
    <div class="form-row"><label class="lbl">Số điện thoại *</label><input class="input" id="co-phone" value="${esc(store.user.phone || '')}"></div>
    <div class="form-row"><label class="lbl">Địa chỉ giao hàng *</label><input class="input" id="co-addr" placeholder="Số nhà, đường, phường/xã, tỉnh/thành"></div>
    <div class="form-row"><label class="lbl">Ghi chú</label><textarea class="input" id="co-note" rows="2"></textarea></div>
    <div class="form-row"><label class="lbl">Thanh toán cọc qua</label><select class="input" id="co-pay"><option value="MOMO_QR">📷 MoMo / VietQR (demo)</option><option value="SAFEPAY_WALLET">👛 Ví SafePay</option><option value="BANK_TRANSFER">🏦 Chuyển khoản</option></select></div>
    <button class="btn btn-green" style="width:100%" onclick="doCheckout()">Xác nhận đặt hàng</button>`);
}
async function doCheckout() {
  if (!$('#co-name').value.trim()) { toast('Nhập tên người nhận', 'err'); return; }
  if (!validPhone($('#co-phone').value)) { toast('SĐT giao hàng chưa đúng (VD: 0987654321)', 'err'); return; }
  if (!$('#co-addr').value.trim()) { toast('Nhập địa chỉ giao hàng', 'err'); return; }
  try {
    const cart = await api('/cart');
    if (!cart.items.length) { toast('Giỏ hàng trống', 'err'); return; }
    const r = await api('/cart/checkout', { method: 'POST', body: {
      listingIds: cart.items.map((it) => it.listingId),
      shipName: $('#co-name').value, shipPhone: $('#co-phone').value,
      shipAddress: $('#co-addr').value, note: $('#co-note').value,
      paymentMethod: $('#co-pay').value,
    }});
    closeModal(); updateCartDot();
    toast(r.message + ' 🎉', 'ok');
    location.hash = r.orders.length === 1 ? '#/orders/' + r.orders[0].id : '#/orders';
  } catch (e) { toast(e.message, 'err'); }
}

/* ================= QUÊN / ĐẶT LẠI MẬT KHẨU ================= */
route('forgot', async () => {
  $('#app').innerHTML = `<div class="auth-wrap"><div class="auth-form" style="grid-column:1/-1;max-width:440px">
    <h2 style="font-size:24px;font-weight:800;margin-bottom:6px">🔑 Quên mật khẩu</h2>
    <p class="muted" style="margin-bottom:20px;font-size:13.5px">Nhập email đăng ký, chúng tôi sẽ gửi mã OTP 6 số.</p>
    <form onsubmit="return doForgot(event)">
    <div class="form-row"><label class="lbl">Email</label><input class="input" id="fg-email" type="email" required placeholder="ban@email.com"></div>
    <button class="btn btn-green" style="width:100%">Gửi mã OTP</button></form>
    <div id="fg-result" style="margin-top:16px"></div>
    <p style="text-align:center;margin-top:16px"><a href="#/login" style="color:var(--blue);font-size:13px">← Quay lại đăng nhập</a></p></div></div>`;
});
async function doForgot(e) {
  e.preventDefault();
  try {
    const r = await api('/auth/forgot-password', { method: 'POST', auth: false, body: { email: $('#fg-email').value } });
    $('#fg-result').innerHTML = `<div class="card" style="padding:16px;background:var(--amber-soft);border-color:#f5d9a8;box-shadow:none">
      <p class="muted" style="font-size:13px">${esc(r.message)}</p>
      <form onsubmit="return doResetOtp(event)"><div class="form-row"><label class="lbl">Mã OTP 6 số</label><input class="input" id="fg-otp" required inputmode="numeric" pattern="\\d{6}" maxlength="6" minlength="6" placeholder="••••••" style="font-size:22px;letter-spacing:8px;text-align:center"></div>
      <div class="form-row"><label class="lbl">Mật khẩu mới (≥6 ký tự, có cả chữ và số)</label><input class="input" id="fg-pass" type="password" required minlength="6"></div>
      <div class="form-row"><label class="lbl">Nhập lại mật khẩu</label><input class="input" id="fg-pass2" type="password" required minlength="6"></div>
      <button class="btn btn-green" style="width:100%">Đổi mật khẩu</button></form>
      <p style="text-align:center;margin-top:10px"><button class="btn btn-line btn-sm" onclick="doForgot(event)">Gửi lại mã</button></p></div>`;
  } catch (err) { toast(err.message, 'err'); }
  return false;
}
async function doResetOtp(e) {
  e.preventDefault();
  if ($('#fg-pass').value !== $('#fg-pass2').value) { toast('Mật khẩu nhập lại không khớp', 'err'); return false; }
  try {
    const r = await api('/auth/reset-password-otp', { method: 'POST', auth: false, body: { email: $('#fg-email').value, otp: $('#fg-otp').value.trim(), newPassword: $('#fg-pass').value } });
    toast(r.message + ' — hãy đăng nhập lại', 'ok'); location.hash = '#/login';
  } catch (err) { toast(err.message, 'err'); }
  return false;
}
route('reset', async (token) => {
  if (!token) { location.hash = '#/forgot'; return; }
  $('#app').innerHTML = `<div class="auth-wrap"><div class="auth-form" style="grid-column:1/-1;max-width:440px">
    <h2 style="font-size:24px;font-weight:800;margin-bottom:6px">🔑 Đặt lại mật khẩu</h2>
    <p class="muted" style="margin-bottom:20px;font-size:13.5px">Nhập mật khẩu mới cho tài khoản của bạn.</p>
    <form onsubmit="return doReset(event,'${token}')">
    <div class="form-row"><label class="lbl">Mật khẩu mới (≥6 ký tự, có cả chữ và số)</label><input class="input" id="rs-pass" type="password" required minlength="6"></div>
    <div class="form-row"><label class="lbl">Nhập lại mật khẩu</label><input class="input" id="rs-pass2" type="password" required minlength="6"></div>
    <button class="btn btn-green" style="width:100%">Đổi mật khẩu</button></form></div></div>`;
});
async function doReset(e, token) {
  e.preventDefault();
  if ($('#rs-pass').value !== $('#rs-pass2').value) { toast('Mật khẩu nhập lại không khớp', 'err'); return false; }
  try {
    const r = await api('/auth/reset-password', { method: 'POST', auth: false, body: { resetToken: token, newPassword: $('#rs-pass').value } });
    toast(r.message + ' — hãy đăng nhập lại', 'ok'); location.hash = '#/login';
  } catch (err) { toast(err.message, 'err'); }
  return false;
}

/* ================= BIỂU ĐỒ (Chart.js) ================= */
function killCharts() { (window._charts || []).forEach((c) => { try { c.destroy(); } catch {} }); window._charts = []; }
function drawBar(canvasId, labels, values, label) {
  if (!window.Chart) { $('#' + canvasId).outerHTML = '<p class="muted">Không tải được thư viện biểu đồ (cần mạng).</p>'; return; }
  Chart.defaults.font.family = "'Be Vietnam Pro', system-ui, sans-serif";
  Chart.defaults.color = '#718178';
  window._charts.push(new Chart($('#' + canvasId), {
    type: 'bar',
    data: { labels, datasets: [{ label, data: values, backgroundColor: '#087f5b', borderRadius: 5 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display:false }, ticks: { maxTicksLimit:8, maxRotation:0, font:{size:10} } }, y: { beginAtZero:true, suggestedMax:values.some(v=>v>0)?undefined:100000, grid:{color:'#eaf0ec'}, border:{display:false}, ticks: { maxTicksLimit:5, callback: (v) => v >= 1e6 ? (v / 1e6) + 'tr' : v>=1000 ? (v / 1e3) + 'k' : v } } } },
  }));
}
function drawPie(canvasId, labels, values) {
  if (!window.Chart) { $('#' + canvasId).outerHTML = '<p class="muted">Không tải được thư viện biểu đồ (cần mạng).</p>'; return; }
  const colors = ['#087f5b', '#4a80b5', '#d8ad4e', '#c86469', '#8a75b4', '#8b9d92', '#66b3b6'];
  window._charts.push(new Chart($('#' + canvasId), {
    type: 'pie',
    data: { labels, datasets: [{ data: values, backgroundColor: colors }] },
    options: { responsive: true, plugins: { legend: { position: 'right' } } },
  }));
}
const dstr = (d) => d.toISOString().slice(0, 10);
function dateRangeHTML(prefix, from, to) {
  return `<div class="toolbar"><label class="muted" for="${prefix}-from" style="align-self:center;font-size:13px">Từ ngày</label>
    <input type="date" class="input" id="${prefix}-from" value="${from}">
    <label class="muted" for="${prefix}-to" style="align-self:center;font-size:13px">đến</label>
    <input type="date" class="input" id="${prefix}-to" value="${to}">
    <button class="btn btn-green btn-sm" onclick="${prefix}Reload()">${uiIcon('chart')} Xem</button></div>`;
}

/* ---------- admin: thống kê biểu đồ ---------- */
ADMIN_VIEWS['finance:charts'] = async () => {
  const to = dstr(new Date()), from = dstr(new Date(Date.now() - 30 * 86400 * 1000));
  $('#abody').innerHTML = `<h2 style="margin-bottom:16px">📈 Thống kê doanh thu</h2>
    ${dateRangeHTML('finChart', from, to)}
    <div class="row2" style="grid-template-columns:1.6fr 1fr;align-items:start">
      <div class="sect"><h2>📊 Doanh thu theo ngày</h2><canvas id="fin-bar" height="120"></canvas></div>
      <div class="sect"><h2>🥧 Đơn hàng theo trạng thái</h2><canvas id="fin-pie" height="160"></canvas></div>
    </div>
    <div class="sect"><h2>📋 Số liệu chi tiết</h2><div id="fin-tbl"></div></div>`;
  finChartReload();
};
async function finChartReload() {
  const from = $('#finChart-from').value, to = $('#finChart-to').value;
  killCharts();
  try {
    const [rev, st] = await Promise.all([
      api(`/admin/finance/charts/revenue?from=${from}&to=${to}`),
      api('/admin/finance/charts/order-status'),
    ]);
    drawBar('fin-bar', rev.data.map((r) => r.date.slice(5)), rev.data.map((r) => r.revenue), 'Doanh thu (đ)');
    drawPie('fin-pie', st.map((s) => (ORDER_ST[s.status] || [s.status])[0]), st.map((s) => s.count));
    const totRev = rev.data.reduce((a, r) => a + r.revenue, 0);
    const totOrd = rev.data.reduce((a, r) => a + r.orders, 0);
    $('#fin-tbl').innerHTML = `<div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat"><div class="t">Tổng doanh thu (${from} → ${to})</div><div class="v" style="color:var(--green-dark)">${fmtVND(totRev)}</div></div>
      <div class="stat"><div class="t">Tổng đơn hàng</div><div class="v">${totOrd}</div></div>
      <div class="stat"><div class="t">Phí thu / đơn phát sinh</div><div class="v">${totOrd ? fmtVND(Math.round(totRev / totOrd)) : '—'}</div></div></div>`;
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- admin: bảng đơn hàng ---------- */
async function adminOrdersReload(page = 1) {
  const box = $('#ao-table');
  if (!box) return;
  const status = $('#ao-status').value, q = $('#ao-q').value.trim();
  box.innerHTML = '<p class="muted">Đang tải...</p>';
  try {
    const d = await api(`/orders/admin/all?page=${page}&limit=30${status ? '&status=' + status : ''}${q ? '&q=' + encodeURIComponent(q) : ''}`);
    box.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr><th>Mã đơn</th><th>Sản phẩm</th><th>Người mua</th><th>Người bán</th><th>Tổng tiền</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead><tbody>
      ${d.data.map((o) => `<tr style="cursor:pointer" onclick="location.hash='#/orders/${o.id}'">
        <td><b>#${esc(o.code)}</b></td><td>${esc(o.listing.title.slice(0, 35))}</td>
        <td>${esc(o.buyer.fullName)}</td><td>${esc(o.seller.fullName)}</td>
        <td><b>${fmtVND(o.totalAmount)}</b></td><td>${stPill(o.status)}</td>
        <td class="muted">${fmtDate(o.createdAt)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Không có đơn nào.</td></tr>'}</tbody></table></div>
      ${pagination(d.meta, 'adminOrdersReload')}<p class="muted">Bấm vào dòng để xem chi tiết.</p>`;
  } catch (e) { box.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`; }
}

/* ---------- seller: biểu đồ doanh thu ---------- */
function sellerChartHTML() {
  const to = dstr(new Date()), from = dstr(new Date(Date.now() - 30 * 86400 * 1000));
  return `<div class="sect"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:6px"><h2>📈 Doanh thu shop theo ngày</h2></div>
    ${dateRangeHTML('sellerChart', from, to)}
    <canvas id="seller-bar" height="110"></canvas><div id="seller-tbl" style="margin-top:12px"></div></div>`;
}
async function sellerChartReload() {
  const from = $('#sellerChart-from').value, to = $('#sellerChart-to').value;
  killCharts();
  try {
    const rev = await api(`/seller/charts/revenue?from=${from}&to=${to}`);
    drawBar('seller-bar', rev.data.map((r) => r.date.slice(5)), rev.data.map((r) => r.revenue), 'Doanh thu (đ)');
    const totRev = rev.data.reduce((a, r) => a + r.revenue, 0);
    const totOrd = rev.data.reduce((a, r) => a + r.orders, 0);
    $('#seller-tbl').innerHTML = `<div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat"><div class="t">Doanh thu (${from} → ${to})</div><div class="v" style="color:var(--green-dark)">${fmtVND(totRev)}</div></div>
      <div class="stat"><div class="t">Đơn hàng</div><div class="v">${totOrd}</div></div>
      <div class="stat"><div class="t">Thu ròng / đơn phát sinh</div><div class="v">${totOrd ? fmtVND(Math.round(totRev / totOrd)) : '—'}</div></div></div>`;
  } catch (e) { toast(e.message, 'err'); }
}

/* ================= GIAN HÀNG ================= */
route('shops', async () => {
  const q = currentQuery.shopQ || '';
  const res = await api('/shops/search?q=' + encodeURIComponent(q) + '&limit=12', { auth: false });
  const card = (s) => `<div class="card" style="padding:22px;cursor:pointer;text-align:center;transition:.18s" onclick="location.hash='#/shop/${s.id}'" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform=''">
    <div style="display:flex;justify-content:center;margin-bottom:12px">${avatarHtml({ fullName: s.shopName, avatarUrl: s.avatarUrl }, 72)}</div>
    <b style="font-size:15px">${esc(s.shopName)}</b>
    <div style="margin:8px 0;color:#f59e0b;font-size:14px">★ ${s.rating.toFixed(1)} <span class="muted" style="font-size:12px">(${s.totalReviews} đánh giá)</span></div>
    <div class="muted" style="font-size:12px">📦 ${s.productsCount} sản phẩm · ${s.responseRate == null ? 'Chưa đủ dữ liệu phản hồi' : 'Phản hồi ' + s.responseRate + '%'}</div>
    <button class="btn btn-line btn-sm" style="margin-top:12px">Xem gian hàng</button></div>`;
  $('#app').innerHTML = `<div class="wrap"><h1 style="font-size:23px;margin-bottom:4px">🏪 Tìm gian hàng</h1>
    <p class="muted" style="margin-bottom:16px">Khám phá các shop uy tín trên Nola2Hand.</p>
    <div class="searchbar" style="max-width:520px;margin-bottom:20px"><input id="shop-q" placeholder="Nhập tên shop..." value="${esc(q)}"><button onclick="doShopSearch()">🔍 Tìm</button></div>
    ${res.data.length ? `<div class="pgrid" style="grid-template-columns:repeat(3,1fr)">${res.data.map(card).join('')}</div>
    <div style="text-align:center;margin:24px 0" class="muted">${res.meta.total} gian hàng</div>`
    : `<div class="empty"><div class="e">🏪</div>${q ? `Không tìm thấy gian hàng "<b>${esc(q)}</b>".` : 'Chưa có gian hàng nào.'}</div>`}</div>`;
  const qi = $('#shop-q');
  if (qi) qi.addEventListener('keydown', (e) => { if (e.key === 'Enter') doShopSearch(); });
});
function doShopSearch() { currentQuery.shopQ = $('#shop-q').value.trim(); render(); }

let viewedShop;
route('shop', async (id) => {
  if (!id) { location.hash = '#/shops'; return; }
  const s = await api('/shops/' + id, { auth: false });
  viewedShop = s;
  $('#app').innerHTML = `<div class="wrap">
    <div class="crumbs"><a onclick="location.hash='#/shops'">Gian hàng</a> / <b style="color:var(--ink)">${esc(s.shopName)}</b></div>
    <div class="card" style="padding:28px;margin-bottom:20px;display:flex;gap:20px;align-items:center;flex-wrap:wrap">
      ${avatarHtml({ fullName: s.shopName, avatarUrl: s.avatarUrl }, 84)}
      <div style="flex:1;min-width:200px"><h1 style="font-size:24px">${esc(s.shopName)}</h1>
        <div class="muted" style="font-size:13px">Chủ shop: ${esc(s.fullName)} · Tham gia ${new Date(s.joinedAt).toLocaleDateString('vi-VN')}</div>
        <div style="display:flex;gap:14px;margin-top:10px;flex-wrap:wrap">
          <span class="badge b-green">★ ${s.rating.toFixed(1)} (${s.totalReviews} đánh giá)</span>
          <span class="badge b-blue">📦 ${s.listings.meta.total} sản phẩm</span>
          <span class="badge b-amber">${s.responseRate == null ? 'Chưa đủ dữ liệu phản hồi' : 'Phản hồi ' + s.responseRate + '%'}</span>
          <span class="badge b-gray">🧾 ${s.totalOrders} đơn đã bán</span>
        </div></div>
      <button class="btn btn-dark" onclick="startChat(${s.id},null)">💬 Chat với shop</button>
    </div>
    <h2 style="font-size:18px;margin-bottom:14px">📦 Sản phẩm của shop (${s.listings.meta.total})</h2>
    <div class="pgrid">${s.listings.data.map(listingCard).join('') || '<p class="muted">Shop chưa có sản phẩm nào đang bán.</p>'}</div>
    ${s.recentReviews.length ? `<h2 style="font-size:18px;margin:24px 0 14px">⭐ Đánh giá gần đây</h2>
    ${s.recentReviews.map((r) => `<div class="card" style="padding:16px 20px;margin-bottom:10px;box-shadow:none"><div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">${avatarHtml(r.reviewer, 32)}<b style="font-size:13px">${esc(r.reviewer.fullName)}</b><span style="color:#f59e0b">${'★'.repeat(r.rating)}</span></div><p style="font-size:13px">${esc(r.comment || '')}</p></div>`).join('')}` : ''}
  </div>`;
});

/* ================= GỢI Ý SẢN PHẨM ================= */
async function recommendedSection() {
  try {
    const r = await api('/listings/recommended?limit=8', { auth: !!store.token });
    if (!r.items.length) return '';
    return `<h2 style="font-size:19px;margin:26px 0 14px">✨ Gợi ý cho bạn ${r.basedOn === 'favorites' ? '<span class="muted" style="font-size:12px;font-weight:400">(dựa trên tin bạn đã lưu)</span>' : ''}</h2>
    <div class="pgrid">${r.items.map(listingCard).join('')}</div>`;
  } catch { return ''; }
}
