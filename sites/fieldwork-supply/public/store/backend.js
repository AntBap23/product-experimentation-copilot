// Explicit web data layer: session campaign context, no URL query strings or raw user agents.
window.fieldworkWebContext=function(action){
 const params=new URLSearchParams(location.search);let entry={};try{entry=JSON.parse(sessionStorage.getItem('fieldwork-web-entry')||'null')||{};}catch{}
 if(!entry.visitor_id){entry={visitor_id:crypto.randomUUID(),referrer_domain:(()=>{try{return new URL(document.referrer).hostname}catch{return 'direct'}})()};for(const k of ['utm_source','utm_medium','utm_campaign'])entry[k]=(params.get(k)||'').slice(0,100);try{sessionStorage.setItem('fieldwork-web-entry',JSON.stringify(entry))}catch{}}
 const ua=navigator.userAgent,mobile=matchMedia('(max-width:700px)').matches;
 const page_type=action==='purchase'?'confirmation':['begin_checkout','add_payment_info','payment_error','return_to_cart'].includes(action)?'checkout':action==='view_item'?'product':'home';
 const result={...entry,page_name:'Fieldwork Supply | '+({home:'Home',product:'Product details',checkout:'Checkout',confirmation:'Order confirmation'}[page_type]),page_type,page_path:location.pathname,page_url:location.origin+location.pathname,site_section:'shop',browser:/Edg/.test(ua)?'Edge':/Firefox/.test(ua)?'Firefox':/Chrome/.test(ua)?'Chrome':'Safari',os:/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Windows/.test(ua)?'Windows':/Mac/.test(ua)?'macOS':'Linux',screen_width:screen.width,screen_height:screen.height,language:navigator.language,context_origin:'browser',schema_version:'fieldwork_web_v1'};
 window.fieldworkDataLayer=result;return result;
};
window.storeBackend = {
 async request(path,body) {
  const response=await fetch('/api/store/'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'The store backend is unavailable.');
  return result;
 },
 login(user,newVisitor=false){return this.request('session',{user,new_visitor:newVisitor,experiment_unit_id:window.fieldworkExperiment.visitor,device:matchMedia('(max-width:700px)').matches?'Mobile':'Desktop',channel:['organic','email','paid_search','social'].includes(window.fieldworkWebContext().utm_source)?window.fieldworkWebContext().utm_source:'organic'});},
 async action(action,data={}){await window.fieldworkExperiment.pending;if(window.fieldworkExperiment.error)throw window.fieldworkExperiment.error;return this.request('action',{action,data:{...data,_web:window.fieldworkWebContext(action)},request_id:crypto.randomUUID()});},
 cart(){return this.request('cart');}
};
