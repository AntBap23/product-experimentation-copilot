import test from 'node:test';
import assert from 'node:assert/strict';
import {runTool,availableTools,openAIAnalysis} from '../platform/core.mjs';
const window={dataset:'fieldwork_synthetic_2000_v1',start:'2026-11-01',end:'2026-11-24'};
test('event-only product interest preserves scope and distinguishes independent user signals',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{const sql=JSON.parse(options.body).query.query;assert.match(sql,/uniqExactIf\(distinct_id/);assert.ok(sql.includes("properties.dataset_id = 'fieldwork_synthetic_2000_v1'"));assert.match(sql,/timestamp < '2026-11-24'/);assert.match(sql,/LIMIT 50$/);return Response.json({columns:['item_id','item_name','viewers','cart_users'],results:[['ridge-22',null,3,5]]});};
 try{const result=await runTool('product_interest',window,{POSTHOG_PERSONAL_API_KEY:'test',POSTHOG_PROJECT_ID:'1'});assert.equal(result.data.products[0].name,'Ridge Daypack');assert.equal(result.data.products[0].unique_viewers,3);assert.equal(result.data.products[0].unique_cart_users,5);assert.ok(!('conversion_rate' in result.data.products[0]));assert.deepEqual(result.window,window);assert.ok(result.data.limitations.some(s=>s.includes('not a sequenced')));assert.match(result.source,/PostHog/);}finally{globalThis.fetch=original;}
});
test('capabilities expose useful event-only tools and keep experiment/commerce scopes separate',()=>{
 const names=w=>availableTools(w).map(t=>t.function.name);
 assert.deepEqual(names(window),['overview','product_interest']);assert.ok(names({...window,dataset:'fieldwork_live_v2'}).includes('products'));assert.deepEqual(names({...window,dataset:'fieldwork_experiment_2000_v1'}),['experiment','experiment_posthog','experiment_reconcile']);
});
test('an event-only question cannot execute an unsupported database-sales tool',async()=>{
 const original=globalThis.fetch;let n=0;const executed=[];
 globalThis.fetch=async(url,options)=>{const request=JSON.parse(options.body);assert.ok(!request.tools.some(t=>t.name==='products'));n++;return Response.json(n===1?{output:[{type:'function_call',name:'products',arguments:'{}',call_id:'unsupported'}]}:n===2?{output:[{type:'function_call',name:'product_interest',arguments:'{}',call_id:'interest'}]}:{output:[{type:'message',content:[{type:'output_text',text:'I interpret liking as behavioral interest; cart activity favors the daypack.'}]}]});};
 try{const result=await openAIAnalysis('what products do users like most',window,{OPENAI_API_KEY:'test',OPENAI_MODEL:'test'},async(name)=>{executed.push(name);return {tool:name,data:{products:[]}}});assert.deepEqual(executed,['product_interest']);assert.equal(result.answer_source,'model');assert.equal(result.evidence.length,1);}finally{globalThis.fetch=original;}
});
