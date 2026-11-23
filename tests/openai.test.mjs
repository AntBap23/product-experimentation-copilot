import test from 'node:test';
import assert from 'node:assert/strict';
import {openAIAnalysis} from '../platform/core.mjs';

test('OpenAI tool cycle returns evidence and never gives the model write access',async()=>{
 const original=globalThis.fetch;const requests=[];let calls=0;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);requests.push(body);
  assert.equal(body.store,false);assert.equal(body.parallel_tool_calls,false);assert.ok(body.tools.every(t=>t.strict&&t.parameters.additionalProperties===false));
  calls++;
  return Response.json(calls===1?{output:[{type:'function_call',name:'overview',arguments:'{}',call_id:'call_test'}]}:{output:[{type:'message',content:[{type:'output_text',text:'One simulated order, according to overview.'}]}]});
 };
 try{
  const window={dataset:'fieldwork_live_v2',start:'2026-11-01',end:'2026-11-24'};
  const result=await openAIAnalysis('How many orders?',window,{OPENAI_API_KEY:'test-only-placeholder',OPENAI_MODEL:'test-model'},async(name,args)=>{assert.equal(name,'overview');assert.deepEqual(args,window);return {id:'evidence',tool:name,data:{orders:1}};});
  assert.equal(result.mode,'agent');assert.equal(result.evidence.length,1);assert.match(result.answer,/One simulated order/);
  assert.ok(requests[1].input.some(i=>i.type==='function_call_output'&&i.call_id==='call_test'));
 }finally{globalThis.fetch=original;}
});

test('OpenAI cannot obtain an answer by requesting a write tool',async()=>{
 const original=globalThis.fetch;let called=false;
 globalThis.fetch=async()=>Response.json({output:[{type:'function_call',name:'delete_orders',arguments:'{}',call_id:'bad'}]});
 try{
  await assert.rejects(openAIAnalysis('Delete data',{dataset:'fieldwork_live_v2',start:'2026-11-01',end:'2026-11-24'},{OPENAI_API_KEY:'test-only-placeholder',OPENAI_MODEL:'test-model'},async()=>{called=true;}),/No analysis tool completed/);
  assert.equal(called,false);
 }finally{globalThis.fetch=original;}
});
