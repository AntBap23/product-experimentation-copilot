// Idempotently mirror confirmed imported purchases, never create storefront orders.
import {readFileSync} from 'node:fs';
import {posthog,rpc} from '../platform/core.mjs';
import {readRevenueEvents,aggregateRevenue} from '../platform/revenue.mjs';
const env=Object.fromEntries(readFileSync(new URL('../.env',import.meta.url),'utf8').split('\n').filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const window={dataset:'fieldwork_synthetic_2000_v1',start:'2026-10-01',end:'2026-11-24'};
const {purchases}=await readRevenueEvents(sql=>posthog(env,sql),window);
for(let i=0;i<purchases.length;i+=200){const r=await fetch(env.SUPABASE_URL+'/rest/v1/fw_imported_purchases?on_conflict=dataset_id,transaction_id',{method:'POST',headers:{apikey:env.SUPABASE_SECRET_KEY,...(env.SUPABASE_SECRET_KEY.startsWith('eyJ')?{Authorization:'Bearer '+env.SUPABASE_SECRET_KEY}:{}),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify(purchases.slice(i,i+200))});if(!r.ok)throw Error('Imported-purchase upsert failed (HTTP '+r.status+'): '+await r.text());}
const left=await rpc(env,'fw_product_revenue',{p_dataset:window.dataset,p_start:window.start,p_end:window.end}),right=aggregateRevenue(purchases);
for(const field of ['total_revenue_cents','purchase_count'])if(Number(left[field])!==right[field])throw Error('Revenue mismatch: '+field);
for(const p of right.products){const q=left.products.find(x=>x.id===p.id);if(!q||Number(q.revenue_cents)!==p.revenue_cents||Number(q.units)!==p.units)throw Error('Product mismatch: '+p.id);}
console.log(JSON.stringify({imported_purchases:purchases.length,currency:'USD',source_comparison:'match',products:left.products,total_revenue_cents:left.total_revenue_cents,window}));
