import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPERIMENT,assign,summarize} from '../platform/experiment.mjs';
import {runTool,analyze} from '../platform/core.mjs';
import {experimentSummary,compareExperiments} from '../platform/experiment-live.mjs';
import {readFileSync} from 'node:fs';
test('visitor allocation is stable and browser assignment matches server contract',async()=>{
 const script=readFileSync(new URL('../sites/fieldwork-supply/public/store/experiment.js',import.meta.url),'utf8');
 for(const visitor of ['visitor-1','visitor-2','signed-in-device','other-device']){
  const storage=new Map([['fw_experiment_visitor',visitor]]),window={};
  Function('window','location','localStorage','crypto','fetch','matchMedia',script)(window,{search:''},{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},crypto,async()=>Response.json({variant:assign(visitor)}),()=>({matches:false}));
  await window.fieldworkExperiment.ready;
  assert.equal(window.fieldworkExperiment.variant,assign(visitor));assert.equal(assign(visitor),assign(visitor));
 }
});
test('experiment attribution ignores pre-exposure, duplicate, foreign and out-of-window events',()=>{
 const event=(uuid,name,day='10',variant='A',dataset=EXPERIMENT.dataset)=>({uuid,event:name,distinct_id:variant,timestamp:`2026-11-${day}T00:00:00.000Z`,properties:{dataset_id:dataset,experiment_id:EXPERIMENT.id,variant,value:84,device:'Mobile',acquisition_channel:'organic'}});
 const purchase=event('purchase','purchase','12');
 const result=summarize([purchase,event('before','purchase','09'),event('b','experiment_exposure','10','B'),event('exposure','experiment_exposure'),purchase,event('outside','purchase','24'),event('foreign','purchase','12','A','other')]);
 assert.equal(result.users,2);assert.equal(result.variants[0].purchases,1);assert.equal(result.variants[0].revenue,84);
 assert.throws(()=>summarize([event('a','experiment_exposure'),{...event('switched','experiment_exposure','11','B'),distinct_id:'A'}]),/switched/);
});
test('generated sample is coherent and experiment evidence enforces dataset and horizon',async()=>{
 const data=JSON.parse(readFileSync(new URL('./fixtures/experiment-summary.json',import.meta.url)));
 assert.equal(data.users,2000);assert.equal(data.variants.reduce((s,v)=>s+v.visitors,0),2000);
 for(const v of data.variants){assert.ok(v.purchases<=v.checkouts&&v.checkouts<=v.carts&&v.carts<=v.engaged&&v.engaged<=v.visitors);}
 const args={dataset:EXPERIMENT.dataset,start:EXPERIMENT.start,end:EXPERIMENT.end};
 const groups=[...data.variants.map(v=>({dimension:'all',segment:'all',...v})),...Object.entries(data.segments).flatMap(([dimension,sets])=>sets.flatMap(s=>s.variants.map(v=>({dimension,segment:s.value,...v}))))];
 const original=globalThis.fetch,env={SUPABASE_URL:'https://test.invalid',SUPABASE_SECRET_KEY:'test-secret'};let reads=0;
 globalThis.fetch=async(url,request)=>{assert.match(url,/fw_experiment_analytics$/);assert.equal(JSON.parse(request.body).p_dataset,EXPERIMENT.dataset);reads++;return Response.json({events:9126,groups});};
 try{
 const evidence=await runTool('experiment',args,env);assert.equal(evidence.data.users,2000);assert.match(evidence.source,/Supabase.*live query/);assert.ok(reads>0);
 await assert.rejects(runTool('experiment',{...args,start:'2026-11-10'},{}),/fixed horizon/);
 await assert.rejects(runTool('overview',args,{}),/experiment tools/);
 const answer=await analyze('Can we ship?',args,env);assert.match(answer.answer,/planted/);assert.equal(answer.evidence[0].tool,'experiment');assert.equal(answer.evidence[1].data.status,'unavailable');
 }finally{globalThis.fetch=original;}
});

test('empty live cohorts have no invented rates, and source comparison detects changed outcomes',()=>{
 const args={dataset:'fieldwork_experiment_live_v1',start:'2026-11-22',end:'2026-11-23'},empty=experimentSummary({events:0,groups:[]},args);
 assert.equal(empty.effect.absolute_pp,null);assert.equal(empty.effect.ci95_pp,null);assert.equal(empty.effect.relative_pct,null);
 assert.equal(compareExperiments(empty,empty).status,'match');const changed=structuredClone(empty);changed.variants[1].purchases=1;assert.equal(compareExperiments(empty,changed).status,'mismatch');
});
