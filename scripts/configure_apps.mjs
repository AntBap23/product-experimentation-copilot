import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
const source=readFileSync(new URL('../.env',import.meta.url),'utf8');
const allowed=new Set(['SUPABASE_URL','SUPABASE_SECRET_KEY','SESSION_SECRET','SIMULATION_TOKEN','POSTHOG_HOST','POSTHOG_PROJECT_TOKEN','POSTHOG_APP_HOST','POSTHOG_PROJECT_ID','POSTHOG_PERSONAL_API_KEY','MODEL_API_KEY','MODEL_NAME','MODEL_BASE_URL','OPENAI_API_KEY','OPENAI_MODEL']);
const config=source.split('\n').filter(line=>allowed.has(line.split('=')[0])).join('\n')+'\n';
for(const site of ['fieldwork-supply','fieldwork-agent']){
 const selected=site==='fieldwork-supply'?config.split('\n').filter(line=>!['OPENAI_API_KEY','OPENAI_MODEL','MODEL_API_KEY','MODEL_NAME','MODEL_BASE_URL','POSTHOG_PERSONAL_API_KEY'].includes(line.split('=')[0])).join('\n'):config;
 writeFileSync(new URL(`../sites/${site}/.dev.vars`,import.meta.url),selected,{mode:0o600});
 for(const name of ['core.mjs','http.mjs','experiment.mjs','experiment-live.mjs','revenue.mjs','web-context.mjs'])copyFileSync(new URL('../platform/'+name,import.meta.url),new URL(`../sites/${site}/lib/platform/${name}`,import.meta.url));
}
console.log('Updated ignored runtime configuration and shared server modules. No secret values printed.');
