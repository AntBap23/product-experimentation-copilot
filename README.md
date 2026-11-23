# Fieldwork · Agentic Product Analytics & Experimentation

**[Open Fieldwork Analytics](https://fieldwork-analytics-demo.antbap23.workers.dev/)**

Fieldwork turns product and website data into an investigation you can inspect.
Ask a question in ordinary language; the AI selects read-only tools, queries
**PostHog and Supabase**, explains its interpretation, and attaches the evidence.
Use the same workspace to review an A/B experiment and prepare an editable
PowerPoint readout for a human decision.

The public analytics app runs on Cloudflare Workers and opens without a ChatGPT
account. It uses the supplied `workers.dev` address; no purchased domain is
required. The storefront is a separate application that collects the activity
being analyzed.

## What the product does

| Workspace | Current functionality |
| --- | --- |
| **Overview** | Website visitors, signed-in shoppers, completed orders, USD revenue, daily orders, checkout step reach, and product sales, with source labels |
| **Ask AI** | Interprets ambiguous questions, chooses supported measures, queries data, compares signals, and explains findings with source evidence |
| **Experiments** | Reviews control A versus variant B, conversion, revenue, funnel steps, guardrails, segments, allocation checks, and uncertainty |
| **Data Sources** | Explains the roles of PostHog and Supabase, distinguishes configuration from successful queries, and compares matching event counts |
| **Data Dictionary** | Searches and filters 22 definitions across metrics, events, dimensions, and experiments; includes calculations, caveats, fields, and editable example questions |

The workspace keeps commerce and experiment scopes separate. Commerce date
changes take effect with **Apply dates**. Experiments have their own cohort,
source, and date controls. All analysis windows use UTC, include the start date,
and exclude the end date.

## Questions you can investigate

- **“What products do users like most?”** The agent interprets this as behavioral
  interest, compares unique viewers and cart users, and adds purchase evidence.
  It distinguishes those signals from ratings or satisfaction.
- **“Which products generate the most revenue?”** It ranks purchase-time line
  revenue in USD and can cross-check Supabase against PostHog.
- **“Where are shoppers dropping out of checkout?”** It examines sessions
  reaching each checkout step and differences by device.
- **“Why are visitor and shopper counts different?”** It queries browser
  profiles separately from signed-in shopper accounts and explains their scope.
- **“Do the sources agree?”** It compares the shared canonical event cohort or
  reconciles saved orders with confirmed PostHog order IDs.
- **“How does variant B compare with control A?”** In Experiments, it examines
  the selected experiment's results, guardrails, source agreement, and limits.

Answers expose their source systems, returned results, exact queries, cohort,
date window, and check time. The model selects and explains analyses; SQL and
application code calculate the measures. It cannot execute arbitrary SQL,
change the data, launch experiments, or ship a variant.

## How the two data sources work

| Source | What it contributes |
| --- | --- |
| **PostHog** | Browser person profiles, native browser sessions, pageviews, product interest, and confirmed server purchase events |
| **Supabase** | Signed-in shopper accounts, shopping sessions, carts, canonical application events, saved orders, and purchase-time order lines |

The storefront captures browser behavior through the PostHog SDK. Its backend
persists application actions and orders in Supabase, then forwards canonical
events through a durable outbox to PostHog. The analytics API independently
queries those sources. OpenAI interprets the evidence; it is not another
analytics data source.

The definitions matter:

- A browser visitor profile is different from a signed-in shopper account.
- A PostHog SDK session has different boundaries from a shopping session.
- Checkout step counts measure session reach, not a strictly ordered funnel.
- Product interest uses independent viewer/cart-user counts, not a satisfaction
  score or a sequential view-to-cart conversion rate.
- Product revenue is gross merchandise revenue in **USD**: quantity multiplied
  by purchase-time unit price. Refunds, tax, and shipping are excluded.

**Compare sources** checks matching canonical event, user, and application-session
counts by event, device, channel, and page. Browser-only traffic is excluded.
PostHog `order_completed` maps to Supabase `purchase`; browser purchase copies
are not added again. Delivery lag can cause temporary differences. Order-ID
reconciliation is a separate, explicitly bounded check of the latest 500 orders
from each source.

## Experiments and human review

The implemented test compares **control A**, where a shopper opens product
details before adding an item, with **variant B**, which adds an **Add to bag**
button on product cards. Assignment and exposure records are persisted; results
use the experiment unit's first exposure and subsequent attributed activity.

The experiment workspace includes a website-interaction cohort and a separately
labeled synthetic example. It shows the designs, outcomes, exploratory segments,
sample-ratio checks, guardrails, and an illustrative interval when the sample
supports the implemented method. It does not turn demo traffic into evidence of
real-customer lift or provide a general self-service experiment builder.

Choose **Create readout** to pin the current result and query evidence. Edit the
summary, conclusion, analyst interpretation, risks, recommendation, next steps,
reviewer, owner, and human decision. Drafts save in the current browser and are
not replaced by a dashboard refresh.

**Download editable PowerPoint** exports native editable text, tables, and charts
with embedded workbooks, control/variant screenshots, and query evidence in
speaker notes. **Download evidence JSON** preserves the snapshot and narrative.
Downloads remain drafts for human review; editing them does not modify the data.

## Storefront and data scope

The separate storefront serves **12 products** from the database catalog. Demo
sign-in supports preset shopper accounts and newly issued visitor profiles.
Carts, checkout states, orders, line items, and canonical events are persisted
through the application backend. Prices are server-authoritative and purchase
retries are idempotent.

**Website activity** contains captured storefront interactions, including manual
and automated demo journeys. Shopper identities are fictional and payments are
demo transactions. Distinct profiles are not independently recruited people or
proof of customer demand. Earlier generated datasets are isolated from the
public website view; no continuous traffic generator is running.

The public app starts with a configured recorded activity window. The dates are
shown and editable; another period may contain different or no activity. Measures
are queried from persisted records, not hardcoded dashboard totals. Experiment
windows and cohorts are selected separately.

## Architecture and access

| Layer | Current implementation |
| --- | --- |
| Interface | React, TypeScript, Vinext, and explicit source/evidence components |
| Public server | Cloudflare Worker with approved read-only analytics routes |
| Analyst | OpenAI Responses API with strict tool schemas and bounded tool-calling rounds |
| Data access | Supabase SQL/RPC queries and PostHog HogQL queries |
| Reports | Browser-generated editable PowerPoint and evidence JSON |
| Usage controls | SQLite-backed Durable Object holding operational quota counters |

The public analytics app allows investigations and exports, not checkout writes
or telemetry retry operations. It rejects unsupported cohorts, arbitrary tool
arguments, cross-origin questions, and spoofed private-site identity headers.
Credentials stay in server secrets and never appear in client bundles.

Public AI investigations are capped at **three per browser per UTC day and 20
globally per UTC day**, with additional request limits. These count attempts,
not dollars; model calls use the separately funded OpenAI account. The deployed
app uses Workers Free and its provided address, subject to provider limits.

The existing storefront and owner-private analytics deployment remain separate
from this public Worker. The public app hides storefront preview links unless a
separately accessible storefront URL is configured.

## Run locally

Use Node **22.13 or newer**. Install the locked dependencies from the repo root:

```sh
npm ci
npm --prefix sites/fieldwork-agent ci
npm --prefix sites/fieldwork-supply ci
```

Create `.env` from `.env.example` only when no local environment file exists.
Preserve an existing configuration. Required server settings depend on the app:

| Configuration | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Application database and analytics queries |
| `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY` | Server-side PostHog queries |
| `POSTHOG_APP_HOST` | Query host when overriding the configured US default |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Model-driven investigations using a model available to the project |
| `POSTHOG_HOST`, `POSTHOG_PROJECT_TOKEN` | Storefront capture; the project capture token is public by design |
| `SESSION_SECRET` | Storefront session signing; at least 32 random characters |

A new database needs the schema and applicable versioned migrations. Use a
separate development project; do not reapply initialization to the existing
populated database or an unrelated project. See the [architecture and setup
guide](docs/platform_build.md).

```sh
npm run configure
# Run these in separate terminals:
npm run dev:analytics   # http://localhost:3000
npm run dev:store       # http://localhost:3001
```

`npm run configure` writes ignored local runtime configuration and synchronizes
shared server modules. Edit `platform/`, not generated
`sites/*/lib/platform/` copies. Storefront capture configuration comes from its
runtime endpoint, not an ignored generated browser-config file. Production
credentials must be configured separately from local `.dev.vars` files.

## Build and deploy

The public analytics target is independent of ChatGPT Sites:

```sh
npm --prefix sites/fieldwork-agent run build:resume
npm --prefix sites/fieldwork-agent run check:resume   # deployment dry run
npm --prefix sites/fieldwork-agent run deploy:resume # authorized Cloudflare account
```

Build this target immediately before checking or deploying it. The script rejects
a private-Sites build. Configure the Worker's database, PostHog, and OpenAI secrets
separately. The public read-only target needs neither storefront session secrets
nor simulation or capture credentials.

The ordinary app `build` commands retain the existing private Sites targets.
See [Cloudflare deployment and public API limits](docs/resume-hosting.md) for the
current commands, variables, and deployment boundaries.

## Verification

```sh
npm test
```

The automated suite covers database transactions, session ownership,
idempotency, catalog price trust, revenue calculations, agent tools, experiment
queries, editable readouts, and the public API's authorization and atomic quotas.
CI runs the suite, TypeScript checks, app builds, and the standalone deployment
dry run. Tests do not require paid model requests.

The deployed public app has also been checked for anonymous access, live data
queries, a model-driven cross-source investigation, matching canonical counts,
blocked public writes, and an editable PowerPoint download. Current values and
source agreement should be inspected in the app for the selected dates rather
than inferred from a fixed count in this README.

## Current boundaries

The public app is a read-only analytics demo. The included experiment, account
profiles, and payments are for demonstration, and the UI does not create arbitrary
new experiments. Reviews, satisfaction, retention, lifetime value, refunds,
cross-device identity, and multi-touch attribution are not dedicated implemented
measures. Source errors, missing data, and mismatches remain visible rather than
being filled with invented results.

There is **no current demo video**. Outdated recordings were removed. A new
recording will follow owner testing and an explicit request.

## Code and guides

| Directory | Responsibility |
| --- | --- |
| `sites/fieldwork-agent/` | Analytics UI, dictionary, report editor, and public Worker target |
| `sites/fieldwork-supply/` | Separate storefront UI and application API |
| `platform/` | Canonical shared tools, metric logic, sessions, and event delivery |
| `database/`, `supabase/migrations/` | Database schema and versioned changes |
| `tests/` | Automated behavior, security, calculation, and export checks |
| `docs/` | Current feature definitions, architecture, and operating guides |

- [Analytics workspace and dictionary](docs/analytics-workspace.md)
- [Collection and source comparison](docs/website-collection.md)
- [Revenue calculation contract](docs/product-revenue.md)
- [Question interpretation](docs/agent-intent.md)
- [Architecture and setup](docs/platform_build.md)
- [Public deployment](docs/resume-hosting.md)

Archived prototype and recording scripts are not the live app's runtime or its
current setup procedure.
