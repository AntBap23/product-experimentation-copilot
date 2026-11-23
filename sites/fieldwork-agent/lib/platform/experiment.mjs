// Shared browser/server experiment contract. No credentials or network calls.
export const EXPERIMENT = {id:'fw_quick_add_v1',name:'Quick add on product cards',dataset:'fieldwork_experiment_2000_v1',seed:20261122,start:'2026-11-09',end:'2026-11-23',unit:'visitor',allocation:0.5};
export function hash(value){let n=2166136261;for(const c of value){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
export function assign(visitor){return hash(EXPERIMENT.id+':'+visitor)/4294967296<.5?'A':'B';}
export function summarize(events){
 const users=new Map(),seen=new Set();
 events=events.filter(e=>{if(seen.has(e.uuid))return false;seen.add(e.uuid);return e.timestamp>=EXPERIMENT.start+'T00:00:00.000Z'&&e.timestamp<EXPERIMENT.end+'T00:00:00.000Z';}).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
 for(const e of events){if(e.properties.dataset_id!==EXPERIMENT.dataset||e.properties.experiment_id!==EXPERIMENT.id)continue;
 const id=e.distinct_id,p=e.properties;let u=users.get(id);
 if(e.event==='experiment_exposure'){if(!['A','B'].includes(p.variant))throw Error('Invalid variant');if(u&&u.variant!==p.variant)throw Error('Visitor switched variants');if(!u){u={id,variant:p.variant,device:p.device,channel:p.acquisition_channel,events:new Set(),revenue:0,product:p.item_id};users.set(id,u);}}
 if(u){u.events.add(e.event);if(e.event==='purchase')u.revenue+=p.value;}
 }
 const rows=[...users.values()];
 const aggregate=list=>['A','B'].map(variant=>{const group=list.filter(u=>u.variant===variant),count=event=>group.filter(u=>u.events.has(event)).length;return {variant,visitors:group.length,engaged:count('view_item'),cta_clicks:count('product_cta_clicked'),carts:count('add_to_cart'),checkouts:count('begin_checkout'),purchases:count('purchase'),payment_errors:count('payment_error'),revenue:Math.round(group.reduce((n,u)=>n+u.revenue,0)),bounce:group.filter(u=>!u.events.has('view_item')).length};});
 const variants=aggregate(rows),[a,b]=variants,pa=a.purchases/a.visitors,pb=b.purchases/b.visitors,se=Math.sqrt(pa*(1-pa)/a.visitors+pb*(1-pb)/b.visitors),difference=pb-pa;
 return {experiment:EXPERIMENT,is_synthetic:true,data_source:'scripted_event_simulation',events:events.length,users:rows.length,variants,effect:{absolute_pp:difference*100,relative_pct:(pb/pa-1)*100,ci95_pp:[(difference-1.96*se)*100,(difference+1.96*se)*100],method:'Unpooled normal 95% interval; independent visitors; fixed horizon; no sequential adjustment'},srm:{chi_square:variants.reduce((s,v)=>s+(v.visitors-rows.length/2)**2/(rows.length/2),0),expected:'50/50',warning:Math.abs(a.visitors-b.visitors)>3.29*Math.sqrt(rows.length)},segments:{device:['Mobile','Desktop'].map(value=>({value,variants:aggregate(rows.filter(u=>u.device===value))})),channel:['organic','email','paid_search','social'].map(value=>({value,variants:aggregate(rows.filter(u=>u.channel===value))}))},assumptions:['Fictional visitors; scripted events, not browser replays or database orders.','Treatment effect is deliberately planted in generation probabilities.','One session per visitor; first exposure is the denominator.','Segments are exploratory; no multiple-comparison adjustment.','Revenue is simulated gross merchandise value; no payment processed.']};
}
