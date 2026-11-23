import test from 'node:test';
import assert from 'node:assert/strict';
import {windowArgs,signSession,readSession,posthogQuery,chooseTools,runTool} from '../platform/core.mjs';
import {api} from '../platform/http.mjs';

test('date and dataset bounds prevent unbounded or injected analysis',()=>{
 assert.throws(()=>windowArgs({dataset:"x' OR 1=1"}));
 assert.throws(()=>windowArgs({start:'2026-02-30',end:'2026-03-04'}));
 assert.throws(()=>windowArgs({start:'2025-01-01',end:'2026-01-01'}));
 assert.throws(()=>windowArgs({start:'2026-11-22',end:'2026-11-22'}));
 assert.equal(windowArgs({start:'2026-11-01',end:'2026-11-23'}).dataset,'fieldwork_live_v2');
});
test('shopper cookies are signed and tampering is rejected',async()=>{
 const key='a'.repeat(48),claims={user:'fieldwork-demo-alex',session_id:crypto.randomUUID(),dataset_id:'fieldwork_live_v2'};
 const token=await signSession(claims,key);assert.equal((await readSession(token,key)).user,claims.user);
 await assert.rejects(readSession(token+'x',key));await assert.rejects(readSession(token,'b'.repeat(48)));
});
test('agent selects approved read-only tools and cannot run model-supplied SQL',async()=>{
 assert.deepEqual(chooseTools('Do purchases match PostHog?'),['overview','reconcile']);
 await assert.rejects(runTool('execute_sql',{},{}));
 assert.match(posthogQuery('posthog_orders',{start:'2026-11-01',end:'2026-11-23'}),/event = 'order_completed'/);
});
test('API denies unauthenticated analysis and cross-origin mutations',async()=>{
 const denied=await api(new Request('https://site.test/api/dashboard'),{});assert.equal(denied.status,401);
 const cross=await api(new Request('https://site.test/api/agent',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}),{},{user:'owner'});assert.equal(cross.status,403);
 const configured=await api(new Request('https://site.test/api/status'),{SUPABASE_SECRET_KEY:'secret-value'},{user:'owner'});
 assert.ok(!(await configured.text()).includes('secret-value'));
});
