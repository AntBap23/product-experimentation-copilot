import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReadoutDraft,readoutManifest,textPages} from '../sites/fieldwork-agent/lib/readout/readout.mjs';
test('human readout edits preserve the queried metric snapshot and provenance',()=>{
 const data=JSON.parse(readFileSync(new URL('./fixtures/experiment-summary.json',import.meta.url),'utf8'));data.scripted_fixture=true;
 const source={data,evidence:{checked_at:'2026-11-23T06:00:00Z',source:'Supabase · live query',query:'select source_metrics()'},checked_at:'2026-11-23T06:00:00Z',comparison:{status:'match',differences:[]}};
 const draft=createReadoutDraft(source);draft.fields.reviewer='Product team';draft.fields.recommendation='Plan a real-customer test';
 assert.equal(draft.snapshot.data.variants[0].purchases,118);source.data.variants[0].purchases=999;assert.equal(draft.snapshot.data.variants[0].purchases,118);
 const manifest=readoutManifest(draft);assert.equal(manifest.reviewer,'Product team');assert.match(manifest.review_status,/human review/);assert.equal(manifest.synthetic_fixture,true);assert.deepEqual(manifest.editable_objects,['text','tables','charts']);
 assert.throws(()=>createReadoutDraft({}),/Query experiment evidence/);
});
test('long editable narratives retain every word across slide pages',()=>{
 const original=Array.from({length:600},(_,i)=>'word'+i).join(' ');const pages=textPages(original,780);assert.ok(pages.length>1);assert.equal(pages.join(' '),original);assert.ok(pages.every(p=>p.length<=780));
});
