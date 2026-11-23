# Public analytics deployment

[Fieldwork Analytics](https://fieldwork-analytics-demo.antbap23.workers.dev/) is
currently deployed on Cloudflare Workers. Visitors need no ChatGPT account or
purchased domain. The React/Vinext interface queries PostHog and Supabase through
approved read-only tools. The existing owner-private storefront is separate.

## Build targets

Run from the repository root after installing dependencies and configuring the
local environment:

```sh
npm --prefix sites/fieldwork-agent run build:resume
npm --prefix sites/fieldwork-agent run check:resume
npm --prefix sites/fieldwork-agent run deploy:resume
```

`check:resume` performs a deployment dry run; `deploy:resume` publishes using the
authorized Cloudflare account. Build immediately before either command. The
script checks the generated Worker name and usage-control binding and rejects a
private-Sites artifact. The standalone target excludes Sites authentication and
connector proxy plugins.

The ordinary `npm --prefix sites/fieldwork-agent run build` retains the existing
private Sites target. Its access permissions are independent of the public
Worker. Local development and shared-module configuration are described in the
[root README](../README.md#run-locally).

## Runtime configuration

Deploy with Wrangler OAuth. Keep credentials in Worker secrets, never in client
JavaScript, repository files, or a PowerPoint export. Required server settings:

| Settings | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Approved database queries |
| `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` | PostHog query access |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Model-driven investigations |
| `POSTHOG_APP_HOST` | Optional override of the configured US query host |

Wrangler's secret bulk command can load an ignored local file or stdin using the
generated `dist/server/wrangler.json` configuration. Run it from the analytics
app directory after the standalone build. Local `.dev.vars` files do not
configure production secrets. This read-only target does not need capture keys,
storefront session secrets, or a simulation token.

`PUBLIC_STOREFRONT_URL` is optional. Set it only for a storefront visitors can
access; the public interface hides store links and previews when unset.
`PUBLIC_DEMO_START` and `PUBLIC_DEMO_END` configure the initial commerce window.
The current recorded window is October 27–November 24, 2026, UTC, end exclusive.
Dates remain visible and editable. Queries use persisted records; no bundled
result replaces an empty window. Experiment dates and cohorts are independent.

## Public API and quotas

The Worker permits only status, dashboard, experiment, source-comparison, and
analyst endpoints. Commerce writes, telemetry retries, unsupported datasets,
arbitrary tool arguments, and cross-origin questions are rejected. Private-Sites
identity and simulation headers are removed before framework routing, including
encoded-path fallthrough.

A SQLite-backed Durable Object atomically counts operational usage. It stores
quota records, not product analytics. Current limits include:

- Three AI investigations per browser per UTC day.
- Twenty AI investigations globally per UTC day.
- Twenty-four API requests per browser per minute and 180 globally per minute.
- Two thousand API requests per UTC day globally.

Investigations count as attempts, not dollars, and may involve several bounded
model calls. A new browser cookie cannot bypass the global cap. The public API
fails closed if usage controls are unavailable, and an alarm removes old quota
records. PostHog and Supabase remain the only analytics source systems.

## Hosting and operating scope

The deployed target uses Workers Free and its supplied `workers.dev` address.
Provider CPU and request limits still apply. OpenAI calls use the separately
funded API account; Supabase and PostHog retain their existing accounts and
limits. The operational quotas above are not a dollar spending guarantee.

No paid Worker plan, purchased domain, or DNS change is required by this setup.
Changing the deployment target does not publish the owner-private storefront.

## Verification

The public HTTPS app has been checked without a ChatGPT session. Live checks
covered both data connections, a model-driven product-revenue investigation,
canonical source agreement, rejected commerce writes, and an editable PowerPoint
download. These checks establish the tested behavior, not a guarantee that every
future query or account limit will succeed.

CI runs the automated suite, TypeScript checks, both application builds, and the
standalone deployment dry run. A dry run validates the deployment artifact;
live queries additionally verify credentials and runtime behavior. Inspect the
app's evidence for the selected window's current totals and query times.
