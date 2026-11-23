import {EXPERIMENT} from './experiment.mjs';
export const LIVE_EXPERIMENT_DATASET='fieldwork_experiment_live_v1';
export function experimentWindow(args){
 if(![EXPERIMENT.dataset,LIVE_EXPERIMENT_DATASET].includes(args.dataset))throw Error('Choose an experiment dataset.');
 if(args.dataset===EXPERIMENT.dataset&&(args.start!==EXPERIMENT.start||args.end!==EXPERIMENT.end))throw Error('Use the synthetic fixed horizon 2026-11-09 to 2026-11-23 (exclusive).');
 return args;
}
const metricKeys=['visitors','engaged','cta_clicks','carts','checkouts','purchases','payment_errors','revenue','bounce'];
export function experimentSummary(raw,args){
 if(!raw||!Array.isArray(raw.groups)||!Number.isFinite(Number(raw.events)))throw Error('Incomplete experiment aggregate result.');
 const groups=raw.groups,variantsFor=(dimension,segment)=>['A','B'].map(variant=>{
  const row=groups.find(g=>g.variant===variant&&g.dimension===dimension&&g.segment===segment)||{};
  return {variant,...Object.fromEntries(metricKeys.map(k=>[k,Number(row[k]||0)]))};
 });
 const variants=variantsFor('all','all'),[a,b]=variants,users=a.visitors+b.visitors;
 const ready=a.visitors>=30&&b.visitors>=30&&a.purchases>=5&&b.purchases>=5&&a.visitors-a.purchases>=5&&b.visitors-b.purchases>=5;
 const pa=a.visitors?a.purchases/a.visitors:null,pb=b.visitors?b.purchases/b.visitors:null,d=pa!==null&&pb!==null?pb-pa:null;
 const se=ready?Math.sqrt(pa*(1-pa)/a.visitors+pb*(1-pb)/b.visitors):null;
 const synthetic=args.dataset===EXPERIMENT.dataset;
 return {experiment:{...EXPERIMENT,dataset:args.dataset,start:args.start,end:args.end},is_synthetic:true,scripted_fixture:synthetic,all_payments_simulated:true,data_source:'live_query',events:Number(raw.events||0),assigned:raw.assigned==null?null:Number(raw.assigned),pending_events:raw.pending_events==null?null:Number(raw.pending_events),users,variants,effect:{absolute_pp:d===null?null:d*100,relative_pct:pa&&pb!==null?(pb/pa-1)*100:null,ci95_pp:ready?[(d-1.96*se)*100,(d+1.96*se)*100]:null,method:'Unpooled normal 95% interval; independent visitors; no sequential adjustment. Interval suppressed for sparse samples.'},srm:{chi_square:users?variants.reduce((s,v)=>s+(v.visitors-users/2)**2/(users/2),0):null,expected:'50/50',warning:users>0&&Math.abs(a.visitors-b.visitors)>3.29*Math.sqrt(users)},segments:{device:['Mobile','Desktop'].map(value=>({value,variants:variantsFor('device',value)})),channel:['organic','email','paid_search','social'].map(value=>({value,variants:variantsFor('channel',value)}))},assumptions:[synthetic?'Fictional visitors and a planted treatment effect; raw scripted records are persisted in both sources.':'Real interactions with a demo store; fictional accounts and simulated payments.','First exposure in the selected cohort window; later outcomes before the exclusive end date.','Assignments are visitor-level, not cross-device person identity.','Segments are exploratory; no multiple-comparison or sequential adjustment.','Repeated purchases contribute revenue; conversion counts each visitor once.']};
}
export function compareExperiments(left,right){
 const differences=[];
 const check=(path,a,b)=>{if(Math.abs(Number(a)-Number(b))>.005)differences.push({metric:path,supabase:Number(a),posthog:Number(b)});};
 check('events',left.events,right.events);
 for(const [dimension,sets] of [['all',[{value:'all',variants:left.variants}]],['device',left.segments.device],['channel',left.segments.channel]]){
  for(const segment of sets){const other=dimension==='all'?right.variants:right.segments[dimension].find(s=>s.value===segment.value).variants;
   for(const row of segment.variants)for(const metric of metricKeys)check(`${dimension}.${segment.value}.${row.variant}.${metric}`,row[metric],other.find(v=>v.variant===row.variant)[metric]);
  }
 }
 return {status:differences.length?'mismatch':'match',differences,definition:'Exact raw-event count and all visitor-level metric/segment totals; no tolerance for missing events. Capture acceptance alone is not confirmation.'};
}
// The source filter excludes duplicate browser commerce events. Exposure and purchase
// come from the same authoritative experiment stream in each source.
export function experimentPosthogQueries(args){
 experimentWindow(args);
 const authoritative=args.dataset===LIVE_EXPERIMENT_DATASET?" AND (event NOT IN ('add_to_cart','remove_from_cart','begin_checkout','return_to_cart','add_payment_info','purchase','payment_error') OR properties.commerce_event_id IS NOT NULL) AND (event != 'view_item' OR properties.demo_user_id IS NULL OR properties.commerce_event_id IS NOT NULL)":'';
 const filter=`timestamp >= '${args.start}' AND timestamp < '${args.end}' AND properties.dataset_id = '${args.dataset}' AND properties.experiment_id = '${EXPERIMENT.id}' AND properties.data_source IN ('experiment_synthetic_seed','experiment_backend')${authoritative}`;
 const exposures=`SELECT properties.experiment_unit_id AS unit_id, min(timestamp) AS exposed_at, argMin(properties.variant,timestamp) AS variant, argMin(properties.device,timestamp) AS device, argMin(properties.acquisition_channel,timestamp) AS channel FROM events WHERE ${filter} AND event = 'experiment_exposure' GROUP BY unit_id`;
 const unit=`SELECT e.properties.experiment_unit_id AS unit_id, any(x.variant) AS variant, any(x.device) AS device, any(x.channel) AS channel, toInt(countIf(e.event='view_item')>0) AS engaged, toInt(countIf(e.event='product_cta_clicked')>0) AS cta_clicks, toInt(countIf(e.event='add_to_cart')>0) AS carts, toInt(countIf(e.event='begin_checkout')>0) AS checkouts, toInt(countIf(e.event='purchase')>0) AS purchases, toInt(countIf(e.event='payment_error')>0) AS payment_errors, sumIf(toFloat(e.properties.value),e.event='purchase') AS revenue FROM events AS e INNER JOIN (${exposures}) AS x ON e.properties.experiment_unit_id=x.unit_id WHERE ${filter.replaceAll('timestamp','e.timestamp').replaceAll('properties.','e.properties.')} AND e.timestamp>=x.exposed_at GROUP BY unit_id`;
 const group=dimension=>`SELECT '${dimension}' AS dimension, ${dimension==='all'?"'all'":dimension} AS segment, variant, count() AS visitors, sum(u.engaged) AS engaged, sum(u.cta_clicks) AS cta_clicks, sum(u.carts) AS carts, sum(u.checkouts) AS checkouts, sum(u.purchases) AS purchases, sum(u.payment_errors) AS payment_errors, sum(u.revenue) AS revenue, count()-sum(u.engaged) AS bounce FROM (${unit}) AS u GROUP BY segment,variant ORDER BY segment,variant LIMIT 20`;
 return [`SELECT count() AS events FROM events WHERE ${filter}`,group('all'),group('device'),group('channel')];
}
export function rawPosthogGroups(results){
 return {events:Number(results[0].rows?.[0]?.[0]||0),groups:results.slice(1).flatMap(result=>(result.rows||[]).map(row=>Object.fromEntries(result.columns.map((key,i)=>[key,row[i]]))))};
}
