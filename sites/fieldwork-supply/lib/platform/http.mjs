import { HttpError,signSession,readSession,rpc,flushOutbox,runTool,analyze,windowArgs,posthog,posthogQuery } from './core.mjs';
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
  if(app==='store'&&['/api/agent','/api/dashboard'].includes(path))throw new HttpError(404,'Endpoint not found.');
  if(request.method==='GET'&&path==='/api/status')return respond({supabase:Boolean(env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY),posthog_capture:Boolean(env.POSTHOG_PROJECT_TOKEN&&env.POSTHOG_HOST),posthog_query:Boolean(env.POSTHOG_PERSONAL_API_KEY&&env.POSTHOG_PROJECT_ID),model:Boolean(env.OPENAI_API_KEY&&env.OPENAI_MODEL||env.MODEL_API_KEY&&env.MODEL_NAME),mode:env.OPENAI_API_KEY&&env.OPENAI_MODEL||env.MODEL_API_KEY&&env.MODEL_NAME?'agent':'guided',app});
  if(request.method==='GET'&&path==='/api/store/cart'){
   const session=await sessionFor(request,env);return respond({items:await rpc(env,'fw_cart',{p_user:session.user,p_session:session.session_id}),shopper:session});
  }
  if(request.method==='GET'&&path==='/api/dashboard'){
   const args=windowArgs(Object.fromEntries(url.searchParams));
   const names=['overview','daily','funnel','products','channels'];
   const results=await Promise.allSettled(names.map(name=>runTool(name,args,env)));
   const evidence=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
   const errors=results.flatMap((r,i)=>r.status==='rejected'?[{tool:names[i],message:r.reason.message}]:[]);
   let ph;
   if(env.POSTHOG_PERSONAL_API_KEY){try{ph=await posthog(env,posthogQuery('posthog_overview',args));}catch(error){errors.push({tool:'PostHog',message:error.message});}}
   return respond({evidence,errors,posthog:ph,window:args},evidence.length?200:503);
  }
  if(request.method!=='POST')throw new HttpError(404,'Endpoint not found.');
  mutationGuard(request);
  const length=Number(request.headers.get('content-length')||0);if(length>16000)throw new HttpError(413,'Request is too large.');
  const text=await request.text();if(text.length>16000)throw new HttpError(413,'Request is too large.');
  let body;try{body=JSON.parse(text||'{}');}catch{throw new HttpError(400,'Request must be valid JSON.');}
  if(path==='/api/agent')return respond(await analyze(body.question,body,env));
  if(path==='/api/telemetry/retry')return respond(await flushOutbox(env));
  if(path==='/api/store/session'){
   if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)throw new HttpError(503,'Configure a server session secret before demo sign-in.');
   const id=String(body.user||'');
   if(!simulation&&!/^fieldwork-demo-(alex|jordan|morgan|riley|sam|taylor)$/.test(id))throw new HttpError(400,'Choose one of the six demo shoppers.');
   if(simulation&&!/^fieldwork-flow-v1-(\d{4})$/.test(id))throw new HttpError(400,'Invalid simulated shopper ID.');
   const claims=await rpc(env,'fw_login',{p_user:id,p_session:simulation&&uuid(body.session_id)?body.session_id:crypto.randomUUID(),p_device:body.device==='Mobile'?'Mobile':'Desktop',p_channel:['organic','email','paid_search','social'].includes(body.channel)?body.channel:'organic',p_dataset:simulation?'fieldwork_flow_v1':'fieldwork_live_v2',p_name:'Simulated Shopper '+id.slice(-4),p_at:simulation?validSimulationTime(body.at):new Date().toISOString()});
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
   const result=await rpc(env,'fw_store_action',{p_user:claims.user,p_session:claims.session_id,p_action:body.action,p_data:data,p_request:body.request_id,p_at:simulation?validSimulationTime(body.at):new Date().toISOString()});
   const telemetry=simulation&&body.defer_telemetry?{status:'pending',reason:'Deferred for batch delivery.'}:await flushOutbox(env);
   return respond({...result,telemetry},200,body.action==='demo_signed_out'?{'Set-Cookie':cookie('',url,0)}:{});
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
