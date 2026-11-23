import {webContext} from './web-context.mjs';
import { HttpError,signSession,readSession,rpc,flushOutbox,runTool,analyze,windowArgs,posthog,posthogQuery } from './core.mjs';
import {compareExperiments} from './experiment-live.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const noStore={'Cache-Control':'private, no-store','Content-Type':'application/json'};
const respond=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{...noStore,...headers}});
function mutationGuard(request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,'Cross-origin writes are not allowed.');}
/** @param {Request} request @param {Record<string,string>} env @param {{user?:string,app?:string}} options */
export async function api(request,env,{user,app='analytics'}={}){
 const url=new URL(request.url),path=url.pathname;
 try{
  const simulation=Boolean(env.SIMULATION_TOKEN&&request.headers.get('x-simulation-token')===env.SIMULATION_TOKEN);
  if(!user&&!simulation)throw new HttpError(401,'Sign in with ChatGPT to use this application.');
  if(app==='store'&&['/api/agent','/api/dashboard','/api/experiments','/api/web-comparison'].includes(path))throw new HttpError(404,'Endpoint not found.');
  if(request.method==='GET'&&path==='/api/status')return respond({supabase:Boolean(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY),posthog_capture:Boolean(env.POSTHOG_PROJECT_TOKEN&&env.POSTHOG_HOST),posthog_query:Boolean(env.POSTHOG_PERSONAL_API_KEY&&env.POSTHOG_PROJECT_ID),model:Boolean(env.OPENAI_API_KEY&&env.OPENAI_MODEL||env.MODEL_API_KEY&&env.MODEL_NAME),mode:env.OPENAI_API_KEY&&env.OPENAI_MODEL||env.MODEL_API_KEY&&env.MODEL_NAME?'agent':'guided',app});
  if(request.method==='GET'&&path==='/api/store/cart'){
   const session=await sessionFor(request,env);return respond({items:await rpc(env,'fw_cart',{p_user:session.user,p_session:session.session_id}),shopper:session});
  }
  if(request.method==='GET'&&path==='/api/experiments'){
   const args=windowArgs(Object.fromEntries(url.searchParams)),source=url.searchParams.get('source')||'supabase';
   if(!['supabase','posthog'].includes(source))throw new HttpError(400,'Choose Supabase or PostHog.');
   const results=await Promise.allSettled([runTool('experiment',args,env),runTool('experiment_posthog',args,env)]),primary=results[source==='supabase'?0:1];
   if(primary.status!=='fulfilled')throw primary.reason;
   const supabase=results[0].status==='fulfilled'?results[0].value:null,ph=results[1].status==='fulfilled'?results[1].value:null;
   const comparison=supabase&&ph?compareExperiments(supabase.data,ph.data):{status:'unavailable',differences:[],reason:results.find(r=>r.status==='rejected')?.reason?.message||'One source is unavailable.'};
   return respond({data:primary.value.data,evidence:primary.value,comparison,other_evidence:source==='supabase'?ph:supabase,checked_at:new Date().toISOString()});
  }
  if(request.method==='GET'&&path==='/api/web-comparison')return respond(await runTool('web_compare',windowArgs(Object.fromEntries(url.searchParams)),env));
  if(request.method==='GET'&&path==='/api/dashboard'){
   const args=windowArgs(Object.fromEntries(url.searchParams));
   const names=['overview','daily','funnel','products','channels'];
   const results=await Promise.allSettled(names.map(name=>runTool(name,args,env)));
   const evidence=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
   const errors=results.flatMap((r,i)=>r.status==='rejected'?[{tool:names[i],message:r.reason.message}]:[]);
   let ph,websiteTraffic;
   if(env.POSTHOG_PERSONAL_API_KEY){try{ph=await posthog(env,posthogQuery('posthog_overview',args));}catch(error){errors.push({tool:'PostHog',message:error.message});}}
   if(args.dataset==='fieldwork_live_v2'&&env.POSTHOG_PERSONAL_API_KEY){try{const result=await posthog(env,posthogQuery('website_traffic',args));const row=result.rows[0]||[];websiteTraffic={visitors:row[0],sessions:row[1],pageviews:row[2],events:row[3],source:'PostHog browser events · website activity',scope:'Manual website traffic only; generated cohorts and backend copies excluded.'};}catch(error){errors.push({tool:'website_traffic',message:error.message});}}
   return respond({evidence,errors,posthog:ph,websiteTraffic,window:args},evidence.length?200:503);
  }
  if(request.method!=='POST')throw new HttpError(404,'Endpoint not found.');
  mutationGuard(request);
  const length=Number(request.headers.get('content-length')||0);if(length>16000)throw new HttpError(413,'Request is too large.');
  const text=await request.text();if(text.length>16000)throw new HttpError(413,'Request is too large.');
  let body;try{body=JSON.parse(text||'{}');}catch{throw new HttpError(400,'Request must be valid JSON.');}
  if(path==='/api/agent')return respond(await analyze(body.question,body,env));
  if(path==='/api/telemetry/retry')return respond({commerce:await flushOutbox(env),experiment:await flushOutbox(env,true)});
  if(path==='/api/store/experiment/assignment'){
   if(!uuid(body.unit))throw new HttpError(400,'A visitor UUID is required.');
   return respond(await rpc(env,'fw_experiment_assign',{p_unit:body.unit,p_device:body.device==='Mobile'?'Mobile':'Desktop',p_channel:['organic','email','paid_search','social'].includes(body.channel)?body.channel:'organic'}));
  }
  if(path==='/api/store/experiment/event'){
   if(!uuid(body.unit)||!uuid(body.request_id))throw new HttpError(400,'Visitor and event UUIDs are required.');
   const allowed=['$pageview','experiment_exposure','view_item','view_item_list','product_cta_clicked'];
   if(!allowed.includes(body.event))throw new HttpError(400,'Browser-submitted purchases and commerce outcomes are not accepted.');
   const result=await rpc(env,'fw_experiment_capture',{p_unit:body.unit,p_event:body.event,p_request:body.request_id,p_data:body.data||{}});
   return respond({...result,telemetry:await flushOutbox(env,true)});
  }
  if(path==='/api/store/experiment/link'){
   const claims=await sessionFor(request,env);if(!uuid(body.unit))throw new HttpError(400,'A visitor UUID is required.');
   await rpc(env,'fw_experiment_link',{p_user:claims.user,p_session:claims.session_id,p_unit:body.unit});return respond({linked:true});
  }
  if(path==='/api/store/session'){
   if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)throw new HttpError(503,'Configure a server session secret before demo sign-in.');
   const id=String(body.user||'');
   if(!simulation&&!/^fieldwork-demo-(alex|jordan|morgan|riley|sam|taylor)$/.test(id))throw new HttpError(400,'Choose one of the six demo shoppers.');
   if(simulation&&!/^fieldwork-flow-v1-(\d{4})$/.test(id))throw new HttpError(400,'Invalid simulated shopper ID.');
   const claims=await rpc(env,'fw_login',{p_user:id,p_session:simulation&&uuid(body.session_id)?body.session_id:crypto.randomUUID(),p_device:body.device==='Mobile'?'Mobile':'Desktop',p_channel:['organic','email','paid_search','social'].includes(body.channel)?body.channel:'organic',p_dataset:simulation?'fieldwork_flow_v1':'fieldwork_live_v2',p_name:'Simulated Shopper '+id.slice(-4),p_at:simulation?validSimulationTime(body.at):new Date().toISOString()});
   if(!simulation&&body.experiment_unit_id){if(!uuid(body.experiment_unit_id))throw new HttpError(400,'Invalid experiment visitor.');await rpc(env,'fw_experiment_link',{p_user:id,p_session:claims.session_id,p_unit:body.experiment_unit_id});}
   const token=await signSession(claims,env.SESSION_SECRET);
   return respond({...claims,...(simulation?{token}:{})},200,{'Set-Cookie':cookie(token,url)});
  }
  if(path==='/api/store/action'){
   const claims=await sessionFor(request,env);
   if(!uuid(body.request_id))throw new HttpError(400,'Each action needs a UUID request ID.');
   const allowed=['$pageview','demo_signed_in','view_item','add_to_cart','remove_from_cart','begin_checkout','return_to_cart','add_payment_info','purchase','demo_signed_out','payment_error'];
   if(!allowed.includes(body.action))throw new HttpError(400,'Unsupported shopping action.');
   const data=body.data||{};if(typeof data!=='object'||Array.isArray(data))throw new HttpError(400,'Invalid action data.');
   if(data.quantity!==undefined&&(!Number.isInteger(data.quantity)||data.quantity<1||data.quantity>20))throw new HttpError(400,'Quantity must be an integer between 1 and 20.');
   const result=await rpc(env,'fw_store_action_with_context',{p_user:claims.user,p_session:claims.session_id,p_action:body.action,p_data:{...data,_web:webContext(data._web)},p_request:body.request_id,p_at:simulation?validSimulationTime(body.at):new Date().toISOString()});
   const telemetry=simulation&&body.defer_telemetry?{status:'pending',reason:'Deferred for batch delivery.'}:await flushOutbox(env);
   const experiment_telemetry=simulation&&body.defer_telemetry?{status:'not_applicable'}:await flushOutbox(env,true);
   return respond({...result,telemetry,experiment_telemetry},200,body.action==='demo_signed_out'?{'Set-Cookie':cookie('',url,0)}:{});
  }
  throw new HttpError(404,'Endpoint not found.');
 }catch(error){return respond({error:error instanceof HttpError?error.message:'The request could not be completed.',retryable:!(error instanceof HttpError)||error.status>=500},error instanceof HttpError?error.status:500);}
}
async function sessionFor(request,env){
 if(!env.SESSION_SECRET)throw new HttpError(503,'Server sessions are not configured.');
 const bearer=request.headers.get('authorization');
 const token=bearer?.startsWith('Bearer ')?bearer.slice(7):request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('fw_shopper='))?.slice(11);
 return readSession(token,env.SESSION_SECRET);
}
function cookie(token,url,age=86400){return `fw_shopper=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${url.protocol==='https:'?'; Secure':''}`;}
function validSimulationTime(value){const t=Date.parse(value);if(!Number.isFinite(t)||t>Date.now()||t<Date.now()-93*86400000)throw new HttpError(400,'Simulation timestamps must be within the past 93 days.');return new Date(t).toISOString();}
