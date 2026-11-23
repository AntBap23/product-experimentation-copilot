import test from 'node:test';import assert from 'node:assert/strict';import {normalizePurchases,aggregateRevenue,enrichedItems,readRevenueEvents} from '../platform/revenue.mjs';
const row=(id='order',items=[{item_id:'ridge-22',price:84,quantity:2},{item_id:'summit-750',price:28,quantity:1}],value=196,currency='USD')=>['01a17731-ecb8-7304-a92d-016fad749d14','2026-11-01T00:00:00Z',id,currency,value,JSON.stringify(items)];
test('purchase-time revenue uses exact cents, quantities and transaction deduplication',()=>{const p=normalizePurchases([row(),row()],'fixture');const result=aggregateRevenue(p);assert.equal(result.purchase_count,1);assert.equal(result.currency,'USD');assert.equal(result.total_revenue_cents,19600);assert.deepEqual(result.products.map(x=>[x.id,x.units,x.revenue_cents]),[['ridge-22',2,16800],['summit-750',1,2800]]);assert.equal(enrichedItems([{item_id:'ridge-22',unit_price_cents:8400,quantity:2}],'USD')[0].line_revenue_cents,16800);});
test('unknown currency, corrupt totals and conflicting transaction copies are rejected',()=>{assert.throws(()=>normalizePurchases([row('x',undefined,196,'EUR')],'fixture'),/currency/);assert.throws(()=>normalizePurchases([row('x',undefined,197)],'fixture'),/reconcile/);assert.throws(()=>normalizePurchases([row(),row('order',[{item_id:'summit-750',price:28,quantity:1}],28)],'fixture'),/Conflicting/);});
test('event paging keeps dataset/time scope and excludes browser purchases for live orders',async()=>{let query;const result=await readRevenueEvents(async sql=>{query=sql;return {rows:[]};},{dataset:'fieldwork_live_v2',start:'2026-11-01',end:'2026-11-24'});assert.match(query,/event = 'order_completed'/);assert.match(query,/timestamp < '2026-11-24'/);assert.deepEqual(result.purchases,[]);});

test('commerce purchase capture includes USD line revenue without enriching experiment copies',async()=>{
 const {flushOutbox}=await import('../platform/core.mjs');const original=globalThis.fetch;let experiment=false,captured;
 globalThis.fetch=async(url,options)=>{
  if(url.includes('fw_claim_'))return Response.json([{id:'event',event:'purchase',user_id:'shopper',occurred_at:'2026-11-01T00:00:00Z',properties:experiment?{value:84,currency:'USD'}:{value:168,currency:'USD',items:[{item_id:'ridge-22',quantity:2,unit_price_cents:8400}]}}]);
  if(url.includes('/i/v1/')){captured=JSON.parse(options.body).batch[0];return Response.json({results:{event:{result:'ok'}}});}
  return new Response(null,{status:204});
 };
 const env={SUPABASE_URL:'https://database.test',SUPABASE_SECRET_KEY:'test',POSTHOG_PROJECT_TOKEN:'test',POSTHOG_HOST:'https://capture.test'};
 try{assert.equal((await flushOutbox(env)).status,'accepted');assert.equal(captured.event,'order_completed');assert.equal(captured.properties.revenue_cents,16800);assert.equal(captured.properties.items[0].line_revenue_cents,16800);assert.equal(captured.properties.items[0].currency,'USD');experiment=true;assert.equal((await flushOutbox(env,true)).status,'accepted');assert.equal(captured.event,'purchase');}finally{globalThis.fetch=original;}
});
