# Public resume deployment

The analytics app can run independently on Cloudflare Workers. It uses the existing React/Vinext frontend and read-only Supabase/PostHog tools, with a free `workers.dev` address. No purchased domain or ChatGPT account is required for visitors. The storefront remains a separate app.

## Targets

- `npm --prefix sites/fieldwork-agent run build` retains the existing private Sites target.
- `npm --prefix sites/fieldwork-agent run build:resume` creates the standalone Cloudflare target.
- `npm --prefix sites/fieldwork-agent run check:resume` validates that standalone bundle with a deployment dry run.
- `npm --prefix sites/fieldwork-agent run deploy:resume` publishes the standalone bundle using the current Cloudflare login.

Run `build:resume` immediately before `check:resume` or `deploy:resume`. The deployment script rejects a private Sites build. The standalone build excludes Sites auth and connector proxy plugins. Existing private Site permissions and authentication remain unchanged.

## Credentials

Use Wrangler OAuth (`wrangler login`) for deployment. Secrets are stored in the Worker environment, never client JavaScript or committed files. Required runtime configuration:

- SUPABASE_URL and SUPABASE_SECRET_KEY
- POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID
- OPENAI_API_KEY and OPENAI_MODEL
- Optional POSTHOG_APP_HOST if different from the existing US host

Upload them with `wrangler secret bulk --config dist/server/wrangler.json` through stdin or a local ignored file. Do not provision SIMULATION_TOKEN, session secrets, or capture keys in this read-only analytics deployment. PUBLIC_STOREFRONT_URL can point to a separately public storefront; the link is hidden when unset, so recruiters are not directed to an owner-private store.

## Public boundary

The standalone worker allows only status, dashboard, experiment, comparison and analyst endpoints. Commerce writes, telemetry retries, other datasets, arbitrary tool arguments and cross-origin questions are rejected. The original private API remains behind its existing authentication. Incoming private-Sites identity and simulation headers are stripped before framework routing, including encoded-path fallthrough.

A SQLite-backed Durable Object tracks operational request counts, not analytics data. It atomically enforces 20 AI investigations per UTC day globally, three per browser per day, plus read and minute quotas. These count attempted investigations, not dollars; each investigation can make several bounded model calls. Resetting a browser cookie does not bypass the global cap. If usage controls are unavailable, the public API fails closed. Old quota records are removed on an alarm.

The public app starts with the recorded demo window, October 27–November 24, 2026 (end exclusive), while keeping the dates visible and editable. It queries the persisted data; no bundled result is substituted. Experiments retain their own date controls. Update the configured demo dates when the project receives a new activity period.

## Cost and scope

Target the Workers Free plan and its supplied workers.dev address. Free-plan CPU/request limits still apply and need live verification; the deployment dry run alone does not prove runtime CPU fit. No paid plan, purchased domain, or DNS change is part of this deployment. OpenAI calls use the separately funded API account. Supabase/PostHog retain their existing plans and limits.

Reference: https://developers.cloudflare.com/workers/platform/pricing/ and https://developers.cloudflare.com/workers/configuration/routing/workers-dev/.
