import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const command=process.argv[2];
if(!['build','dev','deploy','check'].includes(command))throw Error('Choose build, dev, deploy or check.');
const env={...process.env,FIELDWORK_DEPLOY_TARGET:'resume'};
if(command==='deploy'||command==='check'){
 if(!existsSync('dist/server/wrangler.json'))throw Error('Run build:resume first.');
 const manifest=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
 if(manifest.name!=='fieldwork-analytics-demo'||!manifest.durable_objects?.bindings?.some(b=>b.name==='PUBLIC_DEMO_USAGE'))throw Error('This build is not the standalone resume demo. Run build:resume before deployment.');
 const args=['node_modules/wrangler/bin/wrangler.js','deploy','--config','dist/server/wrangler.json',...(command==='check'?['--dry-run']:[])];
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env});process.exit(result.status??1);
}
const result=spawnSync(process.execPath,['node_modules/vinext/dist/cli.js',command,...process.argv.slice(3)],{stdio:'inherit',env});process.exit(result.status??1);
