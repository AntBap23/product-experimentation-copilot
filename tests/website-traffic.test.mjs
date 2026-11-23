import test from 'node:test';
import assert from 'node:assert/strict';
import {runTool,availableTools,chooseTools,summarize} from '../platform/core.mjs';
const args={dataset:'fieldwork_live_v2',start:'2026-11-01',end:'2026-11-24'};
const env={POSTHOG_PERSONAL_API_KEY:'test-only',POSTHOG_PROJECT_ID:'test'};
test('website traffic uses the browser cohort and preserves distinct profiles and sessions',async()=>{
 const original=globalThis.fetch;let query;
 globalThis.fetch=async(_url,init)=>{query=JSON.parse(init.body).query.query;return Response.json({columns:['visitors','sessions','pageviews','events'],results:[[500,73,72,2470]]})};
 try{const e=await runTool('website_traffic',args,env);assert.equal(e.source,'PostHog');assert.deepEqual([e.data.visitors,e.data.sessions,e.data.pageviews,e.data.events],[500,73,72,2470]);assert.match(query,/count\(DISTINCT person_id\)/);assert.match(query,/data_source = 'demo_store'/);assert.match(query,/timestamp >= '2026-11-01'/);assert.match(query,/timestamp < '2026-11-24'/);assert.match(e.data.definition,/Not signed-in shopper/);assert.match(summarize([e]),/Profiles are not verified people/)}finally{globalThis.fetch=original}
});
test('website traffic cannot silently substitute another dataset',async()=>{
 await assert.rejects(runTool('website_traffic',{...args,dataset:'fieldwork_flow_v1'},env),/Website activity/);
 for(const dataset of ['fieldwork_flow_v1','fieldwork_synthetic_2000_v1','fieldwork_experiment_live_v1'])assert.equal(availableTools({...args,dataset}).some(t=>t.function.name==='website_traffic'),false);
 assert.equal(availableTools(args).some(t=>t.function.name==='website_traffic'),true);
 assert.deepEqual(chooseTools('How many unique website visitors did we have?'),['website_traffic','overview']);
});
test('incomplete PostHog results are an error rather than fabricated zero counts',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({columns:['visitors','sessions','pageviews','events'],results:[]});
 try{await assert.rejects(runTool('website_traffic',args,env),/incomplete website traffic/)}finally{globalThis.fetch=original}
});
