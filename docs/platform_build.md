# Fieldwork application platform

Two independent websites share a server implementation and a Supabase database:

- `sites/fieldwork-supply`: the shop, with same-origin backend endpoints.
- `sites/fieldwork-agent`: the analytics workspace, chat and evidence inspector.
- `platform/core.mjs` and `platform/http.mjs`: canonical shared server code.
- `database/schema.sql`: initial database provisioning SQL, tested against Postgres.
- `scripts/simulate_shoppers.mjs`: 2,000 shoppers going through application APIs.

The older Streamlit prototype and directly imported synthetic dataset are retained
as prior experiments. They do not establish that this new backend is connected.

## Setup

Node 22.13+ is required. Each Site uses the supplied Vinext framework and its own
locked dependencies. The root test runner uses PGlite to execute the schema and
transaction tests against embedded Postgres, not a mocked order store.

```sh
npm ci
npm --prefix sites/fieldwork-agent ci
npm --prefix sites/fieldwork-supply ci
npm test
```

Create a dedicated Supabase project. Do not apply the schema to either unrelated
existing project. Inspect tables before applying `database/schema.sql` once to the
new project's database. It intentionally does not drop or overwrite existing tables.
Run Supabase security/performance advisors after applying it. All exposed tables
have RLS enabled; browser roles have no grants or RPC execution. Server routes
validate session ownership before running narrowly defined database functions.

Configure the ignored root `.env` using `.env.example`. Never paste secret values
into source files, frontend settings, issue bodies, commit messages, or GitHub.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | New project's API URL |
| `SUPABASE_SECRET_KEY` | Backend-only `sb_secret_...` key; legacy service role JWT also supported |
| `SESSION_SECRET` | Random server signing key, at least 32 characters |
| `SIMULATION_TOKEN` | Random backend simulation authorization token |
| `POSTHOG_PROJECT_TOKEN` | Public ingestion token; separate from query permission |
| `POSTHOG_HOST` | US ingestion host for the connected project |
| `POSTHOG_PERSONAL_API_KEY` | Backend-only personal key restricted to read/query access |
| `POSTHOG_PROJECT_ID` | `760509` for the existing PostHog project |
| `OPENAI_API_KEY` | Securely provisioned server-only OpenAI credential |
| `OPENAI_MODEL` | `gpt-6.1-terra` for the OpenAI Responses tool loop |
| `MODEL_API_KEY` | Optional alternative compatible-provider credential |
| `MODEL_NAME` | Explicit model available to that provider |
| `MODEL_BASE_URL` | OpenAI-compatible API base, never chosen from browser input |

`node scripts/configure_apps.mjs` copies server variables to ignored `.dev.vars`
files and synchronizes the canonical shared server modules into both Site checkouts.
It never prints values. Do not manually edit the copied `lib/platform/*.mjs` files.

```sh
npm run configure
npm run dev:analytics
# In a separate terminal:
npm run dev:store
```

Local previews use the Sites starter's simulated ChatGPT sign-in. Hosted API routes
require the platform's trusted request identity or the explicit simulation token.
Publish new analytics as owner-private. Preserve the storefront's existing access
policy. Do not make either Site public without reviewing authorization: the
current workspace model is designed for a single owner, not multiple tenants.

## Behavior and guarantees

A demo login selects a fictional shopper; it is not customer authentication. The
backend issues an HttpOnly, signed, expiring cookie. Passwords and payment details
are not collected. Sessions and carts persist in Supabase and survive page reloads.
Switching shoppers ends the departing session. A new login starts a new cart.

Prices come from the database catalog. Checkout locks a snapshot of quantities
and prices. Selecting demo payment advances that checkout. Purchase saves an
order, its line items, its canonical event and an outbox record in one transaction.
An explicit UUID request ID makes retries idempotent; the same key with different
inputs is rejected. Unique checkout constraints prevent duplicate orders.

Order IDs are shared across database records and telemetry. PostHog receives
`order_completed` from the server for a canonical database `purchase` event;
`canonical_event=purchase` preserves the mapping. Browser-side `purchase` remains
behavioral telemetry. Never add both event streams together as order counts.

The outbox records pending events, claims deliveries with a processing lease, and
retains event UUIDs across retries. Capture acceptance is distinct from queryable
storage. The reconciliation tool checks actual PostHog records, not just capture
responses. A successful order remains saved if event delivery fails.

The initial retry mechanism is request-triggered, plus an explicit authenticated
`POST /api/telemetry/retry` endpoint. No background scheduler is configured yet.
A failed event can remain pending until another request or explicit retry. This
is visible in the dashboard rather than silently treated as complete delivery.

## Analytics and agent

The dashboard and chat share fixed read-only tools: overview, device funnel,
daily orders, product revenue, channel performance and order reconciliation.
Dataset, dates, SQL templates and limits are enforced by server code. The model
cannot execute arbitrary SQL, choose credentials, or call write endpoints.

With no model credential, chat explicitly says **Guided analysis** and routes to
approved tools using a small set of intents. With a configured compatible model,
it runs a bounded tool-calling loop (five rounds, four calls per round) and returns
tool evidence. Metrics are calculated by SQL/code, never generated by the model.
A local Ollama endpoint can be used through its OpenAI-compatible `/v1` API
in local development. A hosted Site cannot reach a model running on your laptop
without a separately configured reachable service.

Date windows use UTC and an exclusive end date, at most 93 days.

The funnel counts sessions reaching each event, scoped to sessions starting in
the window and events occurring within it. This can truncate outcomes for sessions
near the window end; do not treat it as a matured fixed-window experiment metric.
Revenue is simulated USD revenue. No experiment significance or causal claims are
implemented. The reconciliation currently audits the latest 500 orders from each
source and labels that limit; use smaller windows for a complete bounded audit.

## Application-flow simulation

After backend deployment and a verified manual order:

```sh
# First run a smoke simulation, then expand the same deterministic dataset.
npm run simulate -- --users 2
npm run simulate -- --users 2000
```

Set `STORE_BASE_URL` to the storefront origin. For an owner-private hosted Site,
`STORE_SERVICE_TOKEN` is a supported platform service-access credential; keep it
in `.env`. The simulator also sends `SIMULATION_TOKEN`; neither goes in the URL.

The simulation uses four workers, stable shopper/session/request IDs and a local
checkpoint. Each fictional shopper has two visits over November 9–22 UTC. Requests
call the same login, cart, payment and checkout handlers as the browser. No direct
order inserts or fabricated PostHog purchase imports are used. Telemetry delivery
is deferred until the end to send batches efficiently.

The planted scenario lowers mobile payment completion in the second week.
All flow events have `dataset_id=fieldwork_flow_v1`, `is_synthetic=true`, and
`generation_method=application_flow`. Browser/manual flows use
`fieldwork_live_v2`. The old event-only import uses
`fieldwork_synthetic_2000_v1` and has no application order records.

Do not treat the simulator's progress counters as an audited business metric;
verify final counts directly in Supabase and PostHog. Preserve local checkpoints
for clean resumes. Fixed dates become stale; introduce a new dataset version
before changing the simulation seed/window or behavior.

## GitHub and deployment

Push code, schema, tests, lockfiles and `.env.example` only. `.env`, `.dev.vars`,
node modules, generated data, runtime state and built assets are excluded.
`public/store/analytics-config.js` is generated with the public ingestion token
and is excluded from Git, but included in the storefront deployment assets.

Use the Sites runtime environment tool to configure backend secrets for each
Site; `.dev.vars` does not configure production. Keep `.openai/hosting.json`
free of credentials. GitHub Actions secrets are needed only if adding CI deploys;
ordinary CI tests need no provider credentials.

The analytics frontend can be published in setup mode before credentials exist.
Do not replace the live storefront with the new database-required version until
its Supabase connection and a real hosted checkout have been verified.

## Provisioned development database

Supabase project `mxdmxnbijuhcprozeakh` (Fieldwork Analytics) was created in
AntBap23's Org on the quoted $0/month plan. The schema was applied to its empty
public schema. Verification found six demo shoppers, two catalog products and
11 RLS-enabled tables. Security/performance advisors returned informational
findings only: RLS without policies is deliberate for server-only tables, and
unused indexes are expected on a newly provisioned database. The application
still needs its backend secret key before it can connect over REST.

OpenAI uses the [Responses API function-calling flow](https://developers.openai.com/api/docs/guides/function-calling) with storage disabled, strict tool schemas, server-enforced parameters, and bounded iterations. The new key was provisioned through the OpenAI Developers secure setup flow and saved only to the developer-confirmed ignored `.env` destination. No plaintext key belongs in chat or GitHub.
