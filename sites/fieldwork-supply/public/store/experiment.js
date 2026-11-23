(function(){
 const id='fw_quick_add_v1',params=new URLSearchParams(location.search),forced=params.get('experiment_preview'),preview=['A','B'].includes(forced);
 let visitor;try{visitor=localStorage.getItem('fw_experiment_visitor');if(!visitor){visitor=crypto.randomUUID();localStorage.setItem('fw_experiment_visitor',visitor);}}catch{visitor=crypto.randomUUID();}
 let n=2166136261;for(const c of id+':'+visitor){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}
 const variant=preview?forced:(n>>>0)/4294967296<.5?'A':'B';
 const exp=window.fieldworkExperiment={id,visitor,variant,preview,pending:Promise.resolve(),linked:false,error:null};
 async function request(path,body){const res=await fetch('/api/store/experiment/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await res.json();if(!res.ok)throw Error(result.error||'Experiment persistence failed');return result;}
 exp.ready=preview?Promise.resolve():request('assignment',{unit:visitor,device:matchMedia('(max-width:700px)').matches?'Mobile':'Desktop',channel:['organic','email','paid_search','social'].includes(params.get('utm_source'))?params.get('utm_source'):'organic'}).then(a=>{exp.variant=a.variant;});
 exp.capture=(event,data)=>{
  if(preview||!['$pageview','experiment_exposure','view_item','view_item_list','product_cta_clicked'].includes(event)||data.backend_event_id)return Promise.resolve();
  const write=exp.pending.then(()=>request('event',{unit:visitor,event,request_id:crypto.randomUUID(),data}));exp.pending=write.catch(error=>{exp.error=error;});return write;
 };
 if(preview){const note=document.createElement('div');note.className='experiment-preview';note.textContent='EXPERIMENT PREVIEW · '+variant+' · '+(variant==='A'?'Original product cards':'Quick add on product cards')+' · Analytics excluded';document.body.prepend(note);}
})();
