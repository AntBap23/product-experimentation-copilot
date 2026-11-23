# Fieldwork architecture and setup

The current product consists of a **separate storefront** and a **public
analytics workspace**. They share canonical server modules and the same
application data contracts. The analytics workspace runs independently on
Cloudflare Workers; the existing private Sites targets remain available.

## Runtime components

| Component | Responsibility |
| --- | --- |
| `sites/fieldwork-supply/` | Storefront, demo sessions, catalog, cart and checkout APIs, browser collection |
| `sites/fieldwork-agent/` | Overview, Ask AI, Experiments, Data Sources, Data Dictionary, and readout editor |
| `platform/core.mjs` | Approved read tools, metric/query definitions, source reconciliation, and bounded model tool loop |
| `platform/http.mjs` | Application API validation, session handling, and route dispatch |
| `platform/experiment*.mjs` | Experiment definitions, query scopes, aggregation, and comparison |
| `platform/revenue.mjs` | Purchase-line revenue normalization and independent PostHog aggregation |
| `sites/fieldwork-agent/deploy/` | Standalone public boundary and durable operational quotas |
| `sites/fieldwork-agent/lib/readout/` | Readout snapshot contract and editable PowerPoint generation |
| `database/schema.sql`, `supabase/migrations/` | Initial schema and subsequent database changes |

React/TypeScript and Vinext implement the interface and server integration.
Supabase/Postgres persists application records. PostHog stores browser and
canonical server events. OpenAI Responses API selects read-only tools and
explains their returned evidence. A Durable Object stores quota counters only;
it is not another analytics data source.

## Data path

1. The shop queries the database catalog and identifies a demo shopper/session.
2. Browser interactions are sent through the explicit PostHog SDK data layer.
3. Authenticated application actions are validated server-side and stored in
   Supabase. Purchase stores the order, its trusted line items, canonical event,
   and delivery record atomically.
4. The durable outbox forwards canonical events to PostHog using stable event
   and transaction identifiers. Database `purchase` maps to `order_completed`.
5. Analytics tools query Supabase and PostHog independently for the selected
   cohort and UTC dates. Queries and returned results accompany the answer.
6. Experiment readouts pin a source snapshot. Editing or exporting a readout
   changes a browser draft, not the database.

Order creation is idempotent. A saved order remains saved if event delivery
fails. Acceptance by the capture API is distinct from queryable PostHog storage.
Delivery retries are request-triggered or invoked through an authenticated
retry route; there is no scheduled retry worker. Public analytics does not
expose that route.

## Identity, measurements, and scope

The store supports preset fictional shoppers and server-issued visitor profiles.
A signed, expiring HttpOnly cookie identifies the shopping session. Browser
identity reset/identify follows profile changes. These profiles are not real
customer authentication, and demo payments collect no card details.

Website traffic uses PostHog browser person profiles and SDK sessions. Signed-in
shopper counts and application-session metrics come from Supabase. An experiment
unit is a separate identifier; creating more shopper profiles in one browser does
not create independently assigned experimental participants.

The public commerce cohort is **Website activity** (`fieldwork_live_v2`). It
contains captured site interactions, including manual and automated demo
journeys. Earlier generated cohorts are isolated. The experiment UI offers
website interactions and a separately labeled synthetic fixture.

All windows are UTC, start-inclusive/end-exclusive, and at most 93 days. Commerce
filters and experiment controls have independent scopes. The public app's initial
commerce window is configured in `vite.resume.config.ts` and is visible/editable
in the UI. Empty windows return empty measures, not substituted fixture results.

Revenue uses purchase-time quantity × unit price, expressed in USD. Refunds,
tax, and shipping are excluded. The commerce funnel counts session reach at each
step; it does not enforce a strict ordered sequence. Channel attribution is the
application's documented entry-context model, not a complete multi-touch model.

Canonical source comparison excludes browser-only traffic and compares aggregate
event/user/application-session counts by event, device, channel, and page.
Order-ID reconciliation separately audits the latest 500 orders in each source
and reports its scope. Matching aggregates are not a complete record-level audit.

## Agent and experiment behavior

The OpenAI Responses loop offers only approved tools with strict schemas. Server
code owns dataset, dates, credentials, query templates, and limits. The model may
interpret a business question, select relevant tools, compare their results, and
explain limitations; it cannot run arbitrary SQL or write business data. Missing
connections and unavailable evidence remain visible. A model-free guided route
exists for development, but the public model-driven demo uses configured OpenAI
credentials.

The included A/B test compares product-detail-first cards against quick-add cards.
Assignments/exposures persist in Supabase and canonical events are mirrored to
PostHog. First-exposure attribution, segments, guardrails, sample-ratio checks,
and an illustrative conversion interval are implemented. Sparse samples may have
no interval. Demo/synthetic results do not justify shipping; the UI is not a
general experiment-creation or automatic rollout service.

## Access boundaries

The existing private Sites routes require their trusted platform identity. The
standalone Worker intentionally has a separate public read-only boundary. It
allows status, dashboard, experiment, source-comparison, and analyst requests;
commerce writes and telemetry retries are not public. It rejects unsupported
cohorts, extra agent arguments, cross-origin questions, and spoofed private-site
identity/simulation headers.

Service credentials stay on the server. Database tables/RPCs use the project's
restricted grants and RLS configuration. Storefront routes validate signed
session ownership. The public analytics boundary does not accept arbitrary RPC
names or SQL supplied by visitors.

SQLite-backed Durable Object transactions enforce per-browser and global AI
quotas, plus request limits. Unavailable usage controls fail closed. Counters
are operational data only; analytics still comes from PostHog and Supabase.

## Development setup

Use Node 22.13 or newer and the committed lockfiles:

```sh
npm ci
npm --prefix sites/fieldwork-agent ci
npm --prefix sites/fieldwork-supply ci
```

For a fresh database, review `database/schema.sql` and the applicable changes in
`supabase/migrations/` against a dedicated development project. Preserve migration
history and inspect existing tables before provisioning. The configured project
is already populated; do not reinitialize it as part of routine setup.

Create an ignored `.env` from `.env.example` if none exists. Set:

- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for application/database access.
- `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY`, and optionally
  `POSTHOG_APP_HOST` for server-side queries.
- `OPENAI_API_KEY` and `OPENAI_MODEL` for model-driven analysis, using a model
  available to the selected project.
- `POSTHOG_HOST` and `POSTHOG_PROJECT_TOKEN` for storefront capture.
- `SESSION_SECRET` with at least 32 random characters for storefront sessions.

```sh
npm run configure
npm run dev:analytics
# In another terminal:
npm run dev:store
```

`npm run configure` copies shared `platform/` modules into both apps and writes
ignored `.dev.vars` files without printing values. Edit the canonical modules,
then synchronize. The native local preview uses its development identity; that
mock is excluded from the standalone public target. The shop obtains its public
capture configuration from its runtime endpoint, not a generated static file.

## Builds, hosting, and verification

The analytics app's `build:resume`, `check:resume`, and `deploy:resume` scripts
build, validate, and publish the standalone Cloudflare target. The normal app
`build` scripts preserve the private Sites targets. Build the correct target
immediately before deployment. Local `.dev.vars` files do not provision hosted
secrets. See [public deployment](resume-hosting.md).

`npm test` executes database behavior against PGlite and checks sessions,
idempotency, catalog trust, metric/revenue contracts, agent tools, experiment
analysis, readout exports, and public endpoint/quota controls. CI also runs
TypeScript checks, both app builds, and the standalone dry run. No funded model
request is needed for the automated suite.

Live public verification has covered anonymous access, source queries, a
model-driven source comparison, matching canonical counts, rejected writes, and
an editable PowerPoint download. Use the app's current evidence for counts and
query times; old verification totals are not product defaults.

Archived Streamlit, generation, and recording scripts remain historical tooling.
They are not required to operate or deploy the current public analytics app.
