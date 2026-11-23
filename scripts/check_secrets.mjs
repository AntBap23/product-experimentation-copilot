import {readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd(),secretKeys=['SUPABASE_SECRET_KEY','SESSION_SECRET','SIMULATION_TOKEN','POSTHOG_PERSONAL_API_KEY','MODEL_API_KEY','OPENAI_API_KEY','STORE_SERVICE_TOKEN'];
const config=Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const secrets=secretKeys.map(k=>config[k]).filter(v=>v&&v.length>=16);
let leaks=[];function walk(folder){for(const item of readdirSync(folder)){if(['node_modules','.git','.sites-runtime','.wrangler','.venv','__pycache__','data'].includes(item)||item.startsWith('.env')||item.startsWith('.dev.vars'))continue;const file=path.join(folder,item);if(statSync(file).isDirectory())walk(file);else if(statSync(file).size<10000000){const content=readFileSync(file,'utf8');if(secrets.some(s=>content.includes(s)))leaks.push(path.relative(root,file));}}}
walk(root);if(leaks.length){console.error('Secret values found in:',leaks);process.exit(1);}console.log('No configured server secrets found in source or built files.');
