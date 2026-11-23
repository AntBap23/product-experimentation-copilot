import handler from 'vinext/server/fetch-handler';
import {DurableObject} from 'cloudflare:workers';
import {publicDemoApi,reserveDemoUsage} from './public-api.mjs';
type ResumeEnv=Record<string,any>&{PUBLIC_DEMO_USAGE:DurableObjectNamespace};
export class PublicDemoUsage extends DurableObject<ResumeEnv>{
 async fetch(request:Request){const input:any=await request.json();if(!['agent','read'].includes(input.kind)||typeof input.identity!=='string'||input.identity.length>80)return Response.json({allowed:false},{status:400});
  const result=await reserveDemoUsage(this.ctx.storage,input);
  if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+86400000);
  return Response.json(result);
 }
 async alarm(){const day=new Date().toISOString().slice(0,10),minute=Math.floor(Date.now()/60000);let startAfter:string|undefined,remaining=false;
  while(true){const page=await this.ctx.storage.list<{window:string|number;count:number}>({limit:128,...(startAfter?{startAfter}:{})});if(!page.size)break;const stale=[...page].filter(([key,v])=>key.startsWith('minute:')?v.window!==minute:v.window!==day).map(([key])=>key);if(stale.length)await this.ctx.storage.delete(stale);if(page.size>stale.length)remaining=true;startAfter=[...page.keys()].at(-1);if(page.size<128)break;}
  if(remaining)await this.ctx.storage.setAlarm(Date.now()+86400000);
 }
}
export default {
 async fetch(request:Request,env:ResumeEnv,ctx:ExecutionContext){
  const url=new URL(request.url);
  const cleanHeaders=new Headers(request.headers);for(const name of [...cleanHeaders.keys()])if(name.startsWith('oai-authenticated-')||name==='x-simulation-token')cleanHeaders.delete(name);request=new Request(request,{headers:cleanHeaders});
  if(!url.pathname.startsWith('/api/'))return handler.fetch(request,env,ctx);
  const existing=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('fw_resume='))?.slice(10);
  const identity=existing&&/^[a-f0-9-]{36}$/.test(existing)?existing:crypto.randomUUID();
  const budget=env.PUBLIC_DEMO_USAGE?.get(env.PUBLIC_DEMO_USAGE.idFromName('resume-demo'));
  const reserve=budget?async(kind:string)=>{const r=await budget.fetch('https://usage.internal/',{method:'POST',body:JSON.stringify({kind,identity})});if(!r.ok)throw Error('Usage check failed');return r.json()}:undefined;
  const strings=Object.fromEntries(Object.entries(env).filter(([,v])=>typeof v==='string'));
  const response=await publicDemoApi(request,strings,{reserve});
  const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  if(identity!==existing)headers.append('Set-Cookie',`fw_resume=${identity}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${url.protocol==='https:'?'; Secure':''}`);
  return new Response(response.body,{status:response.status,headers});
 }
};
