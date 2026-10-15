const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function frontend(hash) {
  const elements = new Map();
  const requests = [];
  const document = {
    body: { classList: { toggle() {} } },
    querySelector(selector) {
      if (selector === '.hero-actions a') return null;
      if (!elements.has(selector)) elements.set(selector, { innerHTML: '', value: '', checked: false, style: {}, addEventListener() {} });
      return elements.get(selector);
    },
  };
  const context = vm.createContext({
    document, location: { hash }, URLSearchParams, console, setTimeout,
    localStorage: { getItem: () => null },
    window: { addEventListener() {}, scrollTo() {} },
    fetch: async url => {
      requests.push(url);
      return { ok: true, json: async () => ({ data: [], meta: { page: 1, totalPages: 0, total: 0 } }) };
    },
  });
  const source = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');
  vm.runInContext(source.replace(/\(async function boot\(\) \{[\s\S]*?\}\)\(\);/, ''), context);
  vm.runInContext(`categories = [
    {id: 1, slug: 'dien-tu-cu', name: 'Điện tử cũ'},
    {id: 2, slug: 'noi-that', name: 'Nội thất'},
    {id: 3, slug: 'do-gia-dung', name: 'Đồ gia dụng'}
  ];`, context);
  return { context, requests, document, elements, run: source => vm.runInContext(source, context) };
}

test('direct category links load the matching category and retain URL filters', async () => {
  const app = frontend('#/category/noi-that?minPrice=100000&maxPrice=5000000&condition=USED_GOOD&page=2');
  await app.run('renderOnce()');
  const query = new URLSearchParams(app.requests.find(url => url.startsWith('/api/v1/listings?')).split('?')[1]);
  assert.equal(query.get('categoryId'), '2');
  assert.equal(query.get('minPrice'), '100000');
  assert.equal(query.get('maxPrice'), '5000000');
  assert.equal(query.get('condition'), 'USED_GOOD');
  assert.equal(query.get('page'), '2');
  assert.equal(app.document.title, 'Nội thất — Nola2Hand');
  app.context.location.hash = '#/category/do-gia-dung';
  await app.run('renderOnce()');
  const nextQuery = new URLSearchParams(app.requests.at(-1).split('?')[1]);
  assert.equal(nextQuery.get('categoryId'), '3');
  assert.equal(nextQuery.has('minPrice'), false);
});

test('changing sort resets pagination while retaining category and price filters', async () => {
  const app = frontend('#/category/dien-tu-cu?minPrice=1000000&page=3');
  await app.run('renderOnce()');
  app.run("setFilter('sort', 'price_asc')");
  assert.equal(app.context.location.hash, '#/category/dien-tu-cu?minPrice=1000000&sort=price_asc');
});

test('invalid price ranges do not navigate or send a listing request', () => {
  const app = frontend('#/category/dien-tu-cu');
  app.document.querySelector('#f-min').value = '9000000';
  app.document.querySelector('#f-max').value = '1000000';
  app.run('applyCatalogFilters({preventDefault() {}})');
  assert.equal(app.context.location.hash, '#/category/dien-tu-cu');
  assert.equal(app.requests.length, 0);
  assert.match(app.document.querySelector('#filter-error').textContent, /Giá phải không âm/);
});

test('unknown category links do not silently display all products', async () => {
  const app = frontend('#/category/khong-ton-tai');
  await app.run('renderOnce()');
  assert.equal(app.requests.length, 0);
  assert.match(app.document.querySelector('#app').innerHTML, /Không tìm thấy danh mục/);
});
test('search results use a focused heading instead of the discovery banner',async()=>{
  const app=frontend('#/?q=laptop');await app.run('renderOnce()');const html=app.document.querySelector('#app').innerHTML;
  assert.match(html,/Kết quả cho “laptop”/);assert.ok(!html.includes('home-hero'));assert.ok(!html.includes('category-discovery'));
});
