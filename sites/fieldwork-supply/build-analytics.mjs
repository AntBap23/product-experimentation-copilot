import { writeFileSync } from 'node:fs';

process.loadEnvFile('.env');
const token = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;
if (!token?.startsWith('phc_') || !host || new URL(host).protocol !== 'https:') {
  throw new Error('Set POSTHOG_PROJECT_TOKEN and an HTTPS POSTHOG_HOST in .env');
}
writeFileSync('public/store/analytics-config.js', `window.fieldworkAnalytics = ${JSON.stringify({ token, host })};\n`);
