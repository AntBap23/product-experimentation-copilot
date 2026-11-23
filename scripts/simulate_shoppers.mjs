/** Real application-flow simulation. No direct writes to order tables or PostHog. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const args=process.argv.slice(2),count=Number(args[args.indexOf('--users')+1])||2000;
if(!Number.isInteger(count)||count<1||count>2000)throw Error('--users must be between 1 and 2000');
const config={...process.env};
for(const line of readFileSync(new URL('.env',root),'utf8').split('\n')){if(line&&!line.startsWith('#')&&line.includes('=')){const p=line.indexOf('=');config[line.slice(0,p)]??=line.slice(p+1);}}
if(!config.SIMULATION_TOKEN)throw Error('Set SIMULATION_TOKEN in the ignored .env file.');
const workers=Number(args[args.indexOf('--workers')+1])||16;if(!Number.isInteger(workers)||workers<1||workers>24)throw Error('--workers must be 1–24');
const base=config.STORE_BASE_URL||'http://localhost:3001';
const folder=new URL('data/application-flow-v1/',root);mkdirSync(folder,{recursive:true});
const checkpoint=new URL('progress.json',folder),state=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):{completed:[],orders:0,actions:0};
const complete=new Set(state.completed);
function uuid(key){const hash=createHash('sha256').update(key).digest('hex');return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;}
function sessionUuid(key,timestamp){const hash=BigInt('0x'+createHash('sha256').update(key).digest('hex').slice(0,20));const value=(BigInt(timestamp)<<80n)|(7n<<76n)|(((hash>>62n)&0xfffn)<<64n)|(2n<<62n)|(hash&((1n<<62n)-1n));const hex=value.toString(16).padStart(32,'0');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
function random(seed){let value=seed;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
async function request(path,body,token){
 const requestId=body?.request_id;
 for(let attempt=0;attempt<4;attempt++){
  try{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','x-simulation-token':config.SIMULATION_TOKEN,...(token?{Authorization:'Bearer '+token}:{}),...(config.STORE_SERVICE_TOKEN?{'OAI-Sites-Authorization':'Bearer '+config.STORE_SERVICE_TOKEN}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
   const result=await res.json().catch(()=>({error:'Response was not JSON; check Site access.'}));
   if(res.ok)return result;
   if(res.status<500)throw Object.assign(Error(result.error||'Application rejected the simulated action.'),{permanent:true});
  }catch(error){if(error.permanent||attempt===3)throw error;}
  await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
 }
 throw Error('Application request failed: '+path);
}
async function shopper(number){
 const rng=random(20261122+number),user=`fieldwork-flow-v1-${String(number).padStart(4,'0')}`;
 const device=rng()<.65?'Mobile':'Desktop',channel=['organic','email','paid_search','social'][Math.floor(rng()*4)];
 for(let visit=0;visit<2;visit++){
  // Fixed two complete UTC weeks; all requests go through normal application handlers.
  const day=visit*7+Math.floor(rng()*7);let clock=Date.parse('2026-11-09T09:00:00Z')+day*86400000+Math.floor(rng()*10)*3600000;
  const session=sessionUuid(user+':'+visit,clock),login=await request('/api/store/session',{user,session_id:session,device,channel,at:new Date(clock).toISOString()});
  const context={page_name:'Fieldwork Supply | Home',page_type:'home',page_path:'/store/index.html',page_url:'https://fieldwork-checkout-lab.bapnocap.chatgpt.site/store/index.html',site_section:'shop',referrer_domain:{organic:'www.google.com',email:'mail.example.test',paid_search:'www.google.com',social:'social.example.test'}[channel],utm_source:channel,utm_medium:{organic:'organic',email:'email',paid_search:'cpc',social:'social'}[channel],utm_campaign:visit?'returning_shoppers':'trail_launch',browser:device==='Mobile'?'Mobile Safari':'Chrome',os:device==='Mobile'?'iOS':'Windows',screen_width:device==='Mobile'?390:1440,screen_height:device==='Mobile'?844:900,language:'en-US',visitor_id:user,context_origin:'simulation'};
  let sequence=0;
  async function action(name,data={}){clock+=15000+Math.floor(rng()*45000);sequence++;const result=await request('/api/store/action',{action:name,data:{...data,_web:{...context,page_name:name.includes('checkout')||name.includes('payment')||name==='purchase'?'Fieldwork Supply | Checkout':context.page_name,page_type:name==='purchase'?'confirmation':name.includes('checkout')||name.includes('payment')?'checkout':name==='view_item'?'product':'home'}},request_id:uuid(`${session}:${sequence}:${name}`),at:new Date(clock).toISOString(),defer_telemetry:true},login.token);state.actions++;if(name==='purchase')state.orders++;return result;}
  await action('demo_signed_in');await action('$pageview');
  const product=rng()<.55?'ridge-22':'summit-750';await action('view_item',{item_id:product});
  if(rng()<.65){await action('add_to_cart',{item_id:product,quantity:rng()<.15?2:1});
   if(rng()<.18){const other=product==='ridge-22'?'summit-750':'ridge-22';await action('view_item',{item_id:other});await action('add_to_cart',{item_id:other,quantity:1});if(rng()<.5)await action('remove_from_cart',{item_id:other});}
   if(rng()<.8){const checkout=await action('begin_checkout');
    if(rng()<(device==='Mobile'&&visit===1?.5:.8)){await action('add_payment_info',{checkout_id:checkout.checkout_id});if(rng()<.87)await action('purchase',{checkout_id:checkout.checkout_id});}
    else if(device==='Mobile'&&visit===1&&rng()<.65)await action('payment_error',{checkout_id:checkout.checkout_id});
   }
  }
  await action('demo_signed_out');
 }
 complete.add(number);state.completed=[...complete].sort((a,b)=>a-b);writeFileSync(checkpoint,JSON.stringify(state));
 if(complete.size%25===0)console.log(`${complete.size}/${count} shoppers finished`);
}
const queue=Array.from({length:count},(_,i)=>i+1).filter(n=>!complete.has(n));
console.log(`Application simulation: ${count} shoppers, two visits each, ${workers} workers. Target: ${new URL(base).origin}`);
await Promise.all(Array.from({length:workers},async()=>{while(queue.length)await shopper(queue.shift());}));
for(let i=0;i<1000;i++){const result=await request('/api/telemetry/retry',{});const delivery=result.commerce;if(delivery.status==='pending')throw Error('Database flows completed, but event delivery is pending. Retry delivery after fixing capture.');if(delivery.accepted===0)break;if(i%20===0)console.log('Delivered '+(i+1)+' telemetry batches');}
console.log(JSON.stringify({...state,completed_users:complete.size,completed:undefined},null,2));
console.log('Verify final stored order and event counts in both Supabase and PostHog; accepted delivery alone does not prove ingestion.');
