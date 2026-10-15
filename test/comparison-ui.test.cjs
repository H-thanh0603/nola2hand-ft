const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function app(){
  const storage=new Map(),elements=new Map();
  function element(){return {innerHTML:'',textContent:'',style:{},appendChild(){},remove(){},querySelector(){return element();},querySelectorAll(){return[];},classList:{toggle(){}}};}
  elements.set('#toast-root',element());
  const document={body:{classList:{toggle(){}},appendChild(e){elements.set('#'+e.id,e);}},querySelector:s=>elements.get(s)||null,createElement:element};
  const context=vm.createContext({document,location:{hash:'#/',origin:'http://localhost:4000'},URL,URLSearchParams,console,setTimeout:()=>{},crypto:{randomUUID:()=> 'test'},window:{addEventListener(){},scrollTo(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  for(const name of ['app.js','marketplace.js','secure-workflows.js']){let source=fs.readFileSync(path.join(__dirname,'../frontend',name),'utf8');if(name==='app.js')source=source.replace(/\(async function boot\(\) \{[\s\S]*?\}\)\(\);/,'');vm.runInContext(source,context);}
  return {run:source=>vm.runInContext(source,context),storage,elements};
}
test('comparison cannot select a fourth product and can remove/reload selection',()=>{
  const a=app();a.run('toggleComparison(1);toggleComparison(2);toggleComparison(3);toggleComparison(4)');assert.equal(a.storage.get('nola_compare'),'[1,2,3]');
  a.run('toggleComparison(2)');assert.equal(a.storage.get('nola_compare'),'[1,3]');assert.equal(a.run('comparisonIds().length'),2);
  a.run('clearComparison()');assert.equal(a.elements.get('#comparison-tray').hidden,true);
});
test('comparison ignores corrupted storage and rejects oversized shared URLs',async()=>{
  const a=app();a.storage.set('nola_compare','not-json');assert.equal(a.run('comparisonIds().length'),0);
  a.storage.set('nola_compare','[1,2,3,4]');assert.equal(a.run('comparisonIds().length'),3);
  a.run("location.hash='#/compare?ids=1,2,3,4'");await assert.rejects(a.run('routes.compare()'),/1–3/);
});
test('private evidence markup never sends bearer auth to another origin',()=>{
  const a=app();assert.equal(a.run("isPrivateEvidence('https://other.example/api/v1/upload/evidence/file.png')"),false);
  assert.equal(a.run("isPrivateEvidence('http://localhost:4000/api/v1/upload/evidence/file.png')"),true);
  const markup=a.run("evidencePicture('http://localhost:4000/api/v1/upload/evidence/file.png')");assert.match(markup,/data-evidence-url/);assert.ok(!markup.includes('src="http://localhost:4000/api/v1/upload/evidence/'));
});
test('logout clears an expired session but retains retry on server failure',async()=>{
  const a=app();a.run("clearSession=()=>{store.token=null;store.user=null};store.token='expired';api=async()=>{const e=new Error('Expired');e.status=401;throw e}");
  await a.run('logout()');assert.equal(a.storage.has('nola_token'),false);
  a.run("store.token='live';api=async()=>{throw new Error('Offline')}");await a.run('logout()');assert.equal(a.storage.get('nola_token'),'live');
});
test('mobile filter toggle keeps visual state and aria-expanded together',()=>{
  const a=app(),state={};a.elements.set('#catalog-filters',{classList:{toggle:(name,on)=>{state[name]=on;}}});
  a.run("globalThis.filterButton={value:'false',getAttribute(){return this.value},setAttribute(name,value){this.value=value}}");
  a.run('toggleCatalogFilters(filterButton)');assert.equal(a.run('filterButton.value'),'true');assert.equal(state['filters-open'],true);
  a.run('toggleCatalogFilters(filterButton)');assert.equal(a.run('filterButton.value'),'false');assert.equal(state['filters-open'],false);
});
test('mobile navigation exposes the active route and sends anonymous users to login',()=>{
  const a=app();a.elements.set('#mobile-nav',{innerHTML:''});a.run("location.hash='#/orders/1';renderMobileNav()");
  let html=a.elements.get('#mobile-nav').innerHTML;assert.match(html,/href="#\/orders" aria-current="page"/);assert.match(html,/href="#\/login"/);
  a.run("store.user={id:1};location.hash='#/profile';renderMobileNav()");html=a.elements.get('#mobile-nav').innerHTML;assert.match(html,/href="#\/profile" aria-current="page"/);assert.ok(!html.includes('href="#/login"'));
});
test('product cards escape untrusted titles and location in visible text and attributes',()=>{
  const a=app();const html=a.run("listingCard({id:1,title:'<script>alert(1)</script>\"',city:'<img src=x>',images:[],condition:'USED_GOOD',price:100000})");
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/aria-label="Lưu tin/);assert.match(html,/100[.,]000/);
});
test('buyer entering seller workspace sees onboarding rather than a silent redirect',async()=>{
  const a=app();a.elements.set('#app',{innerHTML:''});a.run("store.token='buyer-session';store.user={id:1,roles:['BUYER']};location.hash='#/seller'");await a.run('routes.seller()');
  assert.equal(a.run('location.hash'),'#/seller');assert.match(a.elements.get('#app').innerHTML,/Mở gian hàng của bạn/);assert.match(a.elements.get('#app').innerHTML,/becomeSeller\(\)/);
});
