// Official PostHog browser bootstrap queues events while the SDK loads.
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split('.');2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement('script')).type='text/javascript',p.crossOrigin='anonymous',p.async=!0,p.src=s.api_host.replace('.i.posthog.com','-assets.i.posthog.com')+'/static/array.js',(r=t.getElementsByTagName('script')[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a='posthog',u.people=u.people||[],o='capture identify reset register set_config'.split(' '),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

// Public capture configuration is fetched from the deployed runtime, never a local-only generated file.
window.fieldworkAnalyticsReady=fetch('/api/store/analytics-config',{credentials:'same-origin'}).then(async response=>{
 if(!response.ok)throw Error('Browser analytics configuration is unavailable.');
 const config=await response.json();if(!config.token||!config.host)throw Error('Browser analytics capture is not configured.');
 posthog.init(config.token,{api_host:config.host,defaults:'2026-08-30',capture_pageview:false,capture_pageleave:false,autocapture:false,disable_session_recording:true});return true;
}).catch(error=>{console.error(error.message);return false;});
