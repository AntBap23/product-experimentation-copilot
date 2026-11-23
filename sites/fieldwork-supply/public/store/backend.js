window.storeBackend = {
 async request(path,body) {
  const response=await fetch('/api/store/'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'The store backend is unavailable.');
  return result;
 },
 login(user){return this.request('session',{user,device:matchMedia('(max-width:700px)').matches?'Mobile':'Desktop',channel:new URLSearchParams(location.search).get('utm_source')==='email'?'email':'organic'});},
 action(action,data={}){return this.request('action',{action,data,request_id:crypto.randomUUID()});},
 cart(){return this.request('cart');}
};
