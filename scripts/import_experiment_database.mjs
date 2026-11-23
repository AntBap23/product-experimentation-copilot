import {readFileSync} from 'node:fs';
import {rpc} from '../platform/core.mjs';
const env=Object.fromEntries(readFileSync(new URL('../.env',import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const events=readFileSync(new URL('../data/fieldwork_experiment_2000_v1/events.jsonl',import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
if(events.length!==9126||new Set(events.map(e=>e.distinct_id)).size!==2000)throw Error('Unexpected synthetic fixture');
let inserted=0;for(let offset=0;offset<events.length;offset+=500){const result=await rpc(env,'fw_import_experiment',{p_events:events.slice(offset,offset+500)});inserted+=result.inserted;console.log(JSON.stringify({received:Math.min(events.length,offset+500),inserted}));}
const result=await rpc(env,'fw_experiment_analytics',{p_dataset:'fieldwork_experiment_2000_v1',p_start:'2026-11-09',p_end:'2026-11-23'});console.log(JSON.stringify({events:result.events,variants:result.groups.filter(g=>g.dimension==='all')},null,2));
