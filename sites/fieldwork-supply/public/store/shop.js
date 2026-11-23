(async()=>{
await window.fieldworkExperiment.ready;
const catalogResponse=await fetch('/api/store/catalog',{credentials:'same-origin'});
const catalogResult=await catalogResponse.json();if(!catalogResponse.ok)throw Error(catalogResult.error||'The catalog could not be loaded.');
const catalog=catalogResult.products;
const escapeText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));


const experiment = window.fieldworkExperiment;
const bag = new Map();
const demoShoppers = [
  { id: 'fieldwork-demo-alex', name: 'Alex' },
  { id: 'fieldwork-demo-jordan', name: 'Jordan' },
  { id: 'fieldwork-demo-morgan', name: 'Morgan' },
  { id: 'fieldwork-demo-riley', name: 'Riley' },
  { id: 'fieldwork-demo-sam', name: 'Sam' },
  { id: 'fieldwork-demo-taylor', name: 'Taylor' },
];
let shopper;
let backendReady = false;
try {
  shopper = demoShoppers.find(user => user.id === sessionStorage.getItem('fieldwork-demo-shopper'));
} catch { /* Demo sign-in still works when storage is unavailable. */ }
const dialog = document.querySelector('#panel');
const content = document.querySelector('#panel-content');
const eventLog = document.querySelector('#events');
const demoSessionId = crypto.randomUUID();
const campaign = {};
for (const field of ['utm_source', 'utm_medium', 'utm_campaign']) {
  const value = new URLSearchParams(location.search).get(field);
  if (value) campaign[field] = value.slice(0, 100);
}
let checkoutId;
let sequence = 0;

function track(event, properties = {}) {
  const data = {
    ...window.fieldworkWebContext(event),
    ...campaign,
    is_generated_traffic: false,
    traffic_origin: 'website',
    experiment_id: experiment.id, variant: experiment.variant, experiment_unit_id: experiment.visitor, allocation_unit: "visitor", experiment_preview: experiment.preview,
    ...properties,
    ...(properties.item_id?{item_name:catalog.find(p=>p.id===properties.item_id)?.name,item_category:catalog.find(p=>p.id===properties.item_id)?.category}:{}),
    demo_session_id: demoSessionId,
    event_sequence: ++sequence,
    data_source: 'demo_store',
    is_demo: true,
    dataset_id: 'fieldwork_live_v2',
    auth_status: shopper ? 'signed_in' : 'guest',
    ...(shopper ? { demo_user_id: shopper.id } : {}),
    ...(checkoutId ? { checkout_id: checkoutId } : {}),
  };
  const row = document.createElement('li');
  row.textContent = event + ' · ' + JSON.stringify(data);
  eventLog.append(row);
  if (!experiment.preview) {window.fieldworkAnalyticsReady?.then(ready=>{if(ready)window.posthog.capture(event,data)});experiment.capture(event,data).catch(error=>showError(error.message));}
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dollars = value => money.format(value);
const total = () => catalog.reduce((sum, item) => sum + item.price * (bag.get(item.id) || 0), 0);
const details = () => ({
  value: total(),
  currency: 'USD',
  items: catalog.filter(item => bag.has(item.id)).map(item => ({
    item_id: item.id, price: item.price, quantity: bag.get(item.id),
  })),
});

function refreshCount() {
  document.querySelector('#count').textContent = [...bag.values()].reduce((sum, qty) => sum + qty, 0);
}

function show(title, markup) {
  content.innerHTML = '<h2 id="panel-title" tabindex="-1">' + escapeText(title) + '</h2>' + markup;
  if (!dialog.open) dialog.showModal();
  content.querySelector('h2').focus();
}

function action(label, callback, className = 'action') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await callback(); } catch (error) { showError(error.message); }
    finally { button.disabled = false; }
  });
  content.append(button);
}

function identifyShopper() {
  if (shopper && !experiment.preview){const user=shopper;window.fieldworkAnalyticsReady?.then(ready=>{if(ready)window.posthog.identify(user.id,{name:user.name+' (Demo)',is_demo:true,data_source:'demo_store'})});}
  document.querySelector('#account').textContent = shopper ? shopper.name + ' · Demo account' : 'Demo sign in';
}

async function changeShopper(next) {
  if(experiment.preview){showError('Preview only: sign-in, checkout and collection are disabled.');return;}
  if (shopper && backendReady) { await storeBackend.action('demo_signed_out'); track('demo_signed_out'); }
  if(await window.fieldworkAnalyticsReady)window.posthog.reset();
  shopper = undefined; backendReady = false;experiment.linked=false;
  bag.clear(); checkoutId = undefined; refreshCount(); identifyShopper();
  try { sessionStorage.removeItem('fieldwork-demo-shopper'); } catch {}
  let server;
  if(experiment.preview){showError('Preview only: open the store without experiment_preview to place a demo order.');return;}
  if (next) server = await storeBackend.login(next.id);
  shopper = next;
  backendReady = Boolean(next);
  try {
    if (shopper) sessionStorage.setItem('fieldwork-demo-shopper', shopper.id);
    else sessionStorage.removeItem('fieldwork-demo-shopper');
  } catch {}
  bag.clear(); checkoutId = undefined; refreshCount(); identifyShopper();
  if (shopper) {
    await storeBackend.action('demo_signed_in');
    await storeBackend.action('$pageview');
    track('demo_signed_in', { backend_session_id: server.session_id });
  }
  dialog.close();
}

function showError(message) {
  let banner = document.querySelector('#store-message');
  if (!banner) { banner=document.createElement('div'); banner.id='store-message'; banner.setAttribute('role','alert'); document.body.prepend(banner); }
  banner.textContent=message;
}
async function syncBag() {
  const result=await storeBackend.cart();
  if(!experiment.preview&&!experiment.linked){await storeBackend.request('experiment/link',{unit:experiment.visitor});experiment.linked=true;}
  bag.clear(); for (const item of result.items) bag.set(item.item_id,item.quantity);
  refreshCount(); return result;
}
async function record(name,properties={}) {
  if(experiment.preview)throw Error('Preview only: checkout and analytics are disabled.');
  const result=await storeBackend.action(name,properties);
  track(name, { ...properties, backend_event_id:result.event_id, ...(result.order_id?{transaction_id:result.order_id}:{}) });
  if (result.telemetry?.status==='pending') showError('Your action is saved in the database. Analytics delivery is waiting to retry.');
  return result;
}

function showAccount() {
  show('Demo account', '<p>Choose a fictional shopper to test signed-in journeys. No password or real account is needed. Switching shoppers clears the bag.</p>');
  if (shopper) {
    const label = document.createElement('p');
    label.textContent = 'Signed in as ' + shopper.name + '. Shopper ID: ' + shopper.id;
    content.append(label);
    action('Sign out', () => changeShopper(undefined));
  }
  for (const user of demoShoppers) {
    if (user.id !== shopper?.id) action('Sign in as ' + user.name, () => changeShopper(user), 'secondary');
  }
}

async function showProduct(item) {
  if (shopper && backendReady) await record('view_item',{item_id:item.id});
  else track('view_item', {item_id:item.id,price:item.price,currency:'USD'});
  show(item.name, '<p>' + escapeText(item.description) + '</p><p>' + dollars(item.price) + '</p>');
  action('Add to bag', async () => {
    track('product_cta_clicked',{item_id:item.id,cta:'details_add'});
    if (!shopper || !backendReady) { showAccount(); return; }
    await record('add_to_cart', {item_id:item.id,quantity:1});
    await syncBag(); showBag();
  });
}

function showBag() {
  checkoutId = undefined;
  const items = catalog.filter(item => bag.has(item.id));
  if (!items.length) {
    show('Your bag', '<p>Your bag is empty.</p>');
    action('Keep shopping', () => dialog.close());
    return;
  }
  show('Your bag', '<ul></ul><p class="subtotal">Subtotal ' + dollars(total()) + '</p>');
  const list = content.querySelector('ul');
  for (const item of items) {
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = item.name + ' × ' + bag.get(item.id) + ' · ' + dollars(item.price * bag.get(item.id));
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + item.name);
    remove.addEventListener('click', async () => {
      remove.disabled=true;
      try { await record('remove_from_cart',{item_id:item.id}); await syncBag(); showBag(); }
      catch(error){showError(error.message);remove.disabled=false;}
    });
    row.append(label, remove);
    list.append(row);
  }
  action('Begin checkout', beginCheckout);
  action('Keep shopping', () => dialog.close(), 'secondary');
}

async function returnToBag() {
  await storeBackend.action('return_to_cart'); await syncBag(); checkoutId=undefined; showBag();
}
async function beginCheckout() {
  const result=await record('begin_checkout');
  checkoutId=result.checkout_id;
  show('Checkout', '<p>Select the simulated payment method to continue.</p><p class="subtotal">Total '+dollars(result.properties.value)+'</p>');
  action('Use demo payment', async () => {
    await record('add_payment_info',{checkout_id:checkoutId});
    show('Review your order','<p>Demo payment selected. No real payment will be taken.</p>');
    action('Place demo order',completePurchase);
    action('Return to bag',returnToBag,'secondary');
  });
  action('Return to bag',returnToBag,'secondary');
}
async function completePurchase() {
  const result=await record('purchase',{checkout_id:checkoutId});
  bag.clear(); checkoutId=undefined; refreshCount();
  show('Order saved','<p>Your simulated order is saved in the database. No payment was taken.</p>');
  const receipt=document.createElement('p'); receipt.textContent='Order ID: '+result.order_id; receipt.className='order-id'; content.append(receipt);
  action('Back to the shop',()=>dialog.close());
}

const products = document.querySelector('#products');
for (const item of catalog) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = '<p class="product-category">'+escapeText(item.category)+'</p><h3>' + escapeText(item.name) + '</h3><p>' + escapeText(item.description) + '</p><p class="price">' + dollars(item.price) + '</p>';
  const button = document.createElement('button');
  button.textContent = experiment.variant === 'B' ? 'Add to bag · '+dollars(item.price) : 'View details';
  if(experiment.variant==='B'){button.className='quick-add';const note=document.createElement('p');note.className='purchase-note';note.textContent='Demo sign-in required · Simulated orders only';card.append(note);}
  button.setAttribute('aria-label', 'View ' + item.name);
  button.addEventListener('click', async () => {
    button.disabled=true;
    try{track('product_cta_clicked',{item_id:item.id,cta:experiment.variant==='B'?'quick_add':'view_details'});
      if(experiment.variant==='A'){await showProduct(item);return;}
      track('view_item',{item_id:item.id,surface:'quick_add'});
      if(!shopper||!backendReady){showAccount();return;}
      await record('add_to_cart',{item_id:item.id,quantity:1});await syncBag();showBag();
    }catch(error){showError(error.message);}finally{button.disabled=false;}
  });
  card.append(button);
  products.append(card);
}

const exposureObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){track('experiment_exposure',{surface:'product_cards'});track('view_item_list',{surface:'product_cards'});exposureObserver.disconnect();}},{threshold:.25});
exposureObserver.observe(products);

document.querySelector('#cart').addEventListener('click', async () => {
  try { if(backendReady) { await storeBackend.action('return_to_cart');await syncBag(); } showBag(); } catch(error){showError(error.message);}
});
document.querySelector('#account').addEventListener('click', showAccount);
document.querySelector('#close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { checkoutId = undefined; });
(async()=>{
 if(experiment.preview){identifyShopper();return;}
 try { const session=await syncBag(); shopper=demoShoppers.find(u=>u.id===session.shopper.user); backendReady=Boolean(shopper); if(shopper)await storeBackend.action('$pageview'); }
 catch(error){shopper=undefined;backendReady=false;if(!error.message.includes('Choose a demo shopper'))showError(error.message);}
 identifyShopper(); track('$pageview',{$current_url:location.origin+location.pathname});
})();

// Explicit human interaction collection; no automatic events are generated as visits.
const recordedDepths=new Set();
addEventListener('scroll',()=>{const scrollable=document.documentElement.scrollHeight-innerHeight;if(scrollable<=0)return;const depth=100*scrollY/scrollable;for(const milestone of [25,50,75,100])if(depth>=milestone&&!recordedDepths.has(milestone)){recordedDepths.add(milestone);track('scroll_depth',{depth_percent:milestone});}},{passive:true});
document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(!link)return;try{const url=new URL(link.href);if(['https:','http:'].includes(url.protocol))track('link_clicked',{link_url:url.origin+url.pathname,link_domain:url.hostname,is_outbound:url.origin!==location.origin});}catch{}});

})().catch(error=>{const banner=document.createElement("div");banner.id="store-message";banner.setAttribute("role","alert");banner.textContent=error.message+" Reload after signing in to retry.";document.body.prepend(banner);});

