import vinext from 'vinext';
import {defineConfig} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';
// Standalone hosting: no Sites authentication, connector proxy, or account dependency.
export default defineConfig({plugins:[vinext(),cloudflare({viteEnvironment:{name:'rsc',childEnvironments:['ssr']},inspectorPort:false,config:{name:'fieldwork-analytics-demo',main:'./deploy/resume-worker.ts',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],workers_dev:true,durable_objects:{bindings:[{name:'PUBLIC_DEMO_USAGE',class_name:'PublicDemoUsage'}]},migrations:[{tag:'v1',new_sqlite_classes:['PublicDemoUsage']}],vars:{PUBLIC_DEMO_START:'2026-10-27',PUBLIC_DEMO_END:'2026-11-24'}}})]});
