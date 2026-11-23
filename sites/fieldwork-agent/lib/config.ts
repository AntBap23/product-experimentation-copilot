import { env as workerEnv } from 'cloudflare:workers';
export function config(): Record<string,string> {
 return Object.fromEntries(Object.entries({...process.env,...workerEnv}).filter(([,value])=>typeof value==='string')) as Record<string,string>;
}
