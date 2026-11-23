import { api } from '../../../lib/platform/http.mjs';
import { config } from '../../../lib/config';
import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
async function handle(request:Request) {
 const user=await getChatGPTUser();
 return api(request,config(),{user:user?.userId,app:'analytics'});
}
export {handle as GET,handle as POST};
