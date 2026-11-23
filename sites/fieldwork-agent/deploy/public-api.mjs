import {api} from '../lib/platform/http.mjs';
import {windowArgs} from '../lib/platform/core.mjs';
const live='fieldwork_live_v2',experiments=['fieldwork_experiment_live_v1','fieldwork_experiment_2000_v1'];
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const routes=new Map([['/api/status','GET'],['/api/dashboard','GET'],['/api/web-comparison','GET'],['/api/experiments','GET'],['/api/agent','POST']]);
/** A separate public read-only boundary. The private Sites auth path is unchanged.
 * @param {Request} request
 * @param {Record<string,string>} env
 * @param {{reserve?:(kind:string)=>Promise<any>,execute?:typeof api}} options
 */
export async function publicDemoApi(request,env,{reserve,execute=api}={}){
 const url=new URL(request.url),method=routes.get(url.pathname);
 if(!method)return json({error:'This endpoint is not available in the public analytics demo.'},404);
 if(request.method!==method)return json({error:'Method not allowed.'},405);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({error:'Use this demo from its own website.'},403);
 let body;
 if(method==='POST'){
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON question.'},415);
  if(Number(request.headers.get('content-length')||0)>8000)return json({error:'Question request is too large.'},413);
  let text='';const reader=request.body?.getReader();let size=0;const decoder=new TextDecoder();if(reader){while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8000){await reader.cancel();return json({error:'Question request is too large.'},413)}text+=decoder.decode(part.value,{stream:true})}text+=decoder.decode()}
  try{body=JSON.parse(text)}catch{return json({error:'Question must be valid JSON.'},400)}
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['question','dataset','start','end'].includes(k)))return json({error:'Only question, dataset and dates are supported.'},400);
  if(typeof body.question!=='string'||!body.question.trim()||body.question.length>2000)return json({error:'Enter a question of up to 2,000 characters.'},400);
 }
 if(url.pathname!=='/api/status'){
  const args=body||Object.fromEntries(url.searchParams),dataset=args.dataset||live;
  const allowed=url.pathname==='/api/experiments'?experiments:url.pathname==='/api/agent'?[live,...experiments]:[live];
  if(!allowed.includes(dataset))return json({error:'Choose Website activity or an available experiment.'},400);
  try{windowArgs({...args,dataset})}catch(e){return json({error:e.message},400)}
 }
 if(typeof reserve!=='function')return json({error:'Public demo usage controls are not configured.'},503);
 let allowance;try{allowance=await reserve(url.pathname==='/api/agent'?'agent':'read')}catch{return json({error:'Public demo usage controls are temporarily unavailable.'},503)}
 if(!allowance?.allowed)return json({error:allowance?.message||'The public demo limit has been reached. Try again later.'},429);
 if(body)request=new Request(request,{body:JSON.stringify(body)});
 const safeEnv={...env,SIMULATION_TOKEN:undefined};
 const response=await execute(request,safeEnv,{user:'public-read-only-demo',app:'analytics'});
 if(url.pathname==='/api/status'&&response.ok){const state=await response.json();let storefront=null;try{const u=new URL(env.PUBLIC_STOREFRONT_URL);if(u.protocol==='https:')storefront=u.href}catch{}
  const defaults=env.PUBLIC_DEMO_START&&env.PUBLIC_DEMO_END?{start:env.PUBLIC_DEMO_START,end:env.PUBLIC_DEMO_END}:null;
  return json({...state,public_demo:true,storefront_url:storefront,default_window:defaults,ai_questions_per_browser:3});
 }
 return response;
}
export async function reserveDemoUsage(storage,{kind,identity,now=Date.now()}){
 const day=new Date(now).toISOString().slice(0,10),minute=Math.floor(now/60000);
 const limits=[['minute:global',minute,180],['minute:'+identity,minute,24],['day:reads',day,2000]];
 if(kind==='agent')limits.push(['day:ai-global',day,20],['day:ai:'+identity,day,3]);
 return storage.transaction(async tx=>{
  const values=[];
  for(const [key,window,limit] of limits){const old=await tx.get(key),count=old?.window===window?old.count:0;if(count>=limit)return {allowed:false,message:key.startsWith('day:ai')?'The public AI demo has reached its daily question limit. Please try again tomorrow.':'The public demo is busy or has reached its usage limit. Please try again later.'};values.push([key,{window,count:count+1}])}
  await tx.put(Object.fromEntries(values));return {allowed:true};
 });
}
