import test from 'node:test';
import assert from 'node:assert/strict';
import {publicDemoApi,reserveDemoUsage} from '../sites/fieldwork-agent/deploy/public-api.mjs';
const origin='https://demo.example',env={SIMULATION_TOKEN:'must-not-pass',PUBLIC_DEMO_START:'2026-10-27',PUBLIC_DEMO_END:'2026-11-24'};
const get=path=>new Request(origin+path);
const post=(path,body,headers={})=>new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
const ok=async()=>({allowed:true});
test('public demo blocks commerce writes, retry routes, arbitrary methods and generated cohorts before dispatch',async()=>{
 let dispatches=0;const options={reserve:ok,execute:async()=>{dispatches++;return Response.json({})}};
 for(const path of ['/api/store/session','/api/store/action','/api/telemetry/retry'])assert.equal((await publicDemoApi(post(path,{}),env,options)).status,404);
 assert.equal((await publicDemoApi(post('/api/dashboard',{}),env,options)).status,405);
 assert.equal((await publicDemoApi(get('/api/dashboard?dataset=fieldwork_flow_v1'),env,options)).status,400);
 assert.equal((await publicDemoApi(get('/api/dashboard?start=2026-11-24&end=2026-11-01'),env,options)).status,400);
 assert.equal(dispatches,0);
});
test('public demo fails closed without quotas and prevents foreign-origin questions',async()=>{
 assert.equal((await publicDemoApi(get('/api/status'),env)).status,503);
 assert.equal((await publicDemoApi(post('/api/agent',{question:'Sales?'},{origin:'https://other.example'}),env,{reserve:ok})).status,403);
 assert.equal((await publicDemoApi(get('/api/status'),env,{reserve:async()=>({allowed:false,message:'Daily limit'})})).status,429);
});
test('agent input is bounded and only server-approved arguments can reach the existing analyst',async()=>{
 let seen;
 const options={reserve:ok,execute:async(request,config,user)=>{seen={body:await request.json(),config,user};return Response.json({answer:'tested'})}};
 assert.equal((await publicDemoApi(post('/api/agent',{question:'How many visitors?',dataset:'fieldwork_live_v2'}),env,options)).status,200);
 assert.equal(seen.body.question,'How many visitors?');assert.equal(seen.config.SIMULATION_TOKEN,undefined);assert.equal(seen.user.user,'public-read-only-demo');
 assert.equal((await publicDemoApi(post('/api/agent',{question:'Sales?',model:'other'}),env,options)).status,400);
 assert.equal((await publicDemoApi(post('/api/agent','x'.repeat(8100)),env,options)).status,413);
 assert.equal((await publicDemoApi(post('/api/agent','{bad'),env,options)).status,400);
});
test('public status exposes demo metadata and never forwards unsafe storefront protocols',async()=>{
 const r=await publicDemoApi(get('/api/status'),{...env,PUBLIC_STOREFRONT_URL:'javascript:bad'}, {reserve:ok,execute:async()=>Response.json({model:true})});const body=await r.json();assert.equal(body.public_demo,true);assert.equal(body.storefront_url,null);assert.deepEqual(body.default_window,{start:'2026-10-27',end:'2026-11-24'});
});
function memoryStorage(){const values=new Map();let queue=Promise.resolve();return {values,transaction(work){const next=queue.then(()=>work({get:async key=>values.get(key),put:async rows=>{for(const [k,v]of Object.entries(rows))values.set(k,v)}}));queue=next.catch(()=>{});return next}}}
test('global daily AI cap cannot be bypassed with new browser identities or concurrent requests',async()=>{
 const storage=memoryStorage(),now=Date.parse('2026-11-23T10:00:00Z');const result=await Promise.all(Array.from({length:50},(_,i)=>reserveDemoUsage(storage,{kind:'agent',identity:'browser-'+i,now})));assert.equal(result.filter(x=>x.allowed).length,20);assert.equal(storage.values.get('day:ai-global').count,20);
 assert.equal((await reserveDemoUsage(storage,{kind:'agent',identity:'next-browser',now:now+86400000})).allowed,true);
});
test('per-browser AI quota allows three questions and rejected attempts do not consume other quotas',async()=>{
 const storage=memoryStorage(),now=Date.parse('2026-11-23T10:00:00Z');for(let i=0;i<3;i++)assert.equal((await reserveDemoUsage(storage,{kind:'agent',identity:'same',now})).allowed,true);assert.equal((await reserveDemoUsage(storage,{kind:'agent',identity:'same',now})).allowed,false);assert.equal(storage.values.get('day:ai-global').count,3);assert.equal(storage.values.get('day:reads').count,3);
});
