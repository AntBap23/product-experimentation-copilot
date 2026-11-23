(function(){
 const id='fw_quick_add_v1',params=new URLSearchParams(location.search),forced=params.get('experiment_preview'),preview=['A','B'].includes(forced);
 let visitor;try{visitor=localStorage.getItem('fw_experiment_visitor');if(!visitor){visitor=crypto.randomUUID();localStorage.setItem('fw_experiment_visitor',visitor);}}catch{visitor=crypto.randomUUID();}
 let n=2166136261;for(const c of id+':'+visitor){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}
 const variant=preview?forced:(n>>>0)/4294967296<.5?'A':'B';
 window.fieldworkExperiment={id,visitor,variant,preview};
 if(preview){const note=document.createElement('div');note.className='experiment-preview';note.textContent='EXPERIMENT PREVIEW · '+variant+' · '+(variant==='A'?'Original product cards':'Quick add on product cards')+' · Analytics excluded';document.body.prepend(note);}
})();
