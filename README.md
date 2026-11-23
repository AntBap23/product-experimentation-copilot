# Fieldwork · Product Analytics & Experimentation Copilot

**[Open the public analytics demo](https://fieldwork-analytics-demo.antbap23.workers.dev/)**

Fieldwork is a working analytics app that investigates product behavior using
**PostHog and Supabase**. Ask a question in plain language, inspect the queries
behind the answer, compare experiment results, and download an editable
PowerPoint readout for human review.

The public analytics app runs independently on **Cloudflare Workers Free** using
a supplied `workers.dev` address. Visitors need no ChatGPT login or purchased
domain. The storefront is a separate application; its existing hosted version
remains owner-private.

## Navigate the app

| Tab | What it does |
| --- | --- |
| **Overview** | Source-labeled visitor, shopper, order, revenue and checkout measures |
| **Ask AI** | Read-only investigations with explicit interpretations and inspectable evidence |
| **Experiments** | Control/variant results, screenshots, source comparison and editable readouts |
| **Data Sources** | Explains PostHog and Supabase, connection checks and canonical event comparison |
| **Data Dictionary** | 22 searchable definitions with calculations, caveats, fields and editable example questions |

Dictionary questions open in the appropriate commerce or experiment workspace.
The agent's evidence includes returned results, the exact query, data source,
cohort, UTC date window and check time. Dates are start-inclusive and
end-exclusive; date edits take effect when **Apply dates** is selected.

## Two analytics sources

| Source | Measures and records |
| --- | --- |
| **PostHog** | Browser visitor profiles, native browser sessions, pageviews, product interest and confirmed server purchase events |
| **Supabase** | Signed-in shopper accounts, shopping sessions, carts, canonical actions, saved orders and purchase-time line items |

The AI queries these systems; it is not a third data source. Browser profiles,
shopper accounts, shopping sessions and experiment units have different
identifiers and definitions. The dictionary explains those differences.

**Compare sources** checks the matching canonical application-event cohort in
both systems. Browser-only activity is excluded, and the PostHog
`order_completed` event is normalized to Supabase `purchase`. Delivery lag can
produce temporary differences. Matching aggregates do not replace a
record-level audit; order-ID reconciliation is a separate tool.

Product revenue is **USD gross merchandise revenue**, calculated from quantity
× purchase-time unit price. Refunds, tax and shipping are not inferred. Browser
purchase copies are excluded from canonical revenue comparisons.

## Data and demo provenance

- The storefront serves **12 active products** from Supabase with trusted prices.
- Website activity comes from actual browser interactions captured by the
  storefront and its backend. The additional 500-profile run operated the
  published UI; it did not import spreadsheet rows or directly seed visit events.
- Demo shopper profiles are fictional and payments are simulated. Distinct
  profiles are not 500 independently recruited people or evidence of customer
  demand.
- Earlier imported and application-generated cohorts remain isolated from the
  Website activity view. No traffic generator runs continuously.
- The website experiment and the synthetic 2,000-visitor example have separate
  cohorts. Demo results cannot justify a real-customer shipping decision.

The public commerce view initially uses the recorded window **October 27 to
November 24, 2026 UTC**, with the end date excluded. Dates remain visible and
editable. It queries persisted data rather than substituting bundled results.
Experiments have their own cohort and date controls.

## Editable PowerPoint readouts

In **Experiments**, choose **Create readout**. Review the pinned source snapshot,
edit the narrative, add a reviewer and follow-up owner, and record a human
decision. **Download editable PowerPoint** exports editable text, tables and
charts, plus control/variant screenshots and complete query evidence in notes.
**Download evidence JSON** retains the associated snapshot and narrative.

Drafts save in the current browser. Refreshing analytics does not replace a
saved draft; **New draft from current data** explicitly creates a new snapshot.
Exports remain drafts for human review. Editing a downloaded deck does not
change the analytics database.

## Public deployment and limits

The public Worker exposes approved **read-only analytics routes**. Checkout
writes, telemetry retries, unsupported cohorts, arbitrary tool arguments and
spoofed private-site identity headers are rejected.

Credentials stay in Cloudflare Worker secrets. A SQLite-backed Durable Object
stores operational usage counters, not analytics data. It atomically limits
public AI investigations to **three per browser per UTC day and 20 globally per
UTC day**, with additional API request limits. These count attempted
investigations, not dollars. OpenAI calls use the separately funded API account;
Cloudflare, Supabase and PostHog retain their respective plan limits.

See [public hosting, credentials and deployment commands](docs/resume-hosting.md).
The existing owner-private Sites deployment remains separate and preserves its
authentication and access settings.

## Local development

Use Node **22.13 or newer**.

```sh
npm ci
npm --prefix sites/fieldwork-supply ci
npm --prefix sites/fieldwork-agent ci
```

Copy `.env.example` to `.env` only if no local environment file exists. Preserve
an existing `.env` and fill missing values. The current Supabase project is
already provisioned: do not reapply its initial schema or generate new traffic
as part of ordinary setup.

| Server variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Database queries and application transactions |
| `POSTHOG_HOST`, `POSTHOG_PROJECT_TOKEN` | Storefront event capture; the capture token is public by design |
| `POSTHOG_APP_HOST`, `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY` | Private server-side analytics queries |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI Responses API investigations |
| `SESSION_SECRET` | Storefront session signing; at least 32 random characters |

Set `OPENAI_MODEL` to a model available to the configured OpenAI project. Paid
model requests are not required for automated tests. Keep server secrets out of
browser bundles, GitHub files, screenshots and recordings. The public read-only
analytics deployment does not need storefront session, simulation or capture
credentials.

```sh
npm run configure
# In separate terminals:
npm run dev:store       # http://localhost:3001
npm run dev:analytics   # http://localhost:3000
```

`npm run configure` copies canonical shared modules into the two apps. Edit
`platform/` rather than generated `sites/*/lib/platform/` copies. Storefront
browser capture configuration is loaded from its deployed runtime endpoint;
an ignored local analytics-config file is not a deployment dependency.

For standalone Cloudflare hosting:

```sh
npm --prefix sites/fieldwork-agent run build:resume
npm --prefix sites/fieldwork-agent run check:resume   # deployment dry run
npm --prefix sites/fieldwork-agent run deploy:resume # requires authorized Cloudflare login
```

Run `build:resume` immediately before deploying that target. The deployment
script rejects an existing private-Sites build. Runtime secrets must be
configured separately as described in the hosting guide.

## Validation

The current implementation passes **37 automated tests**, TypeScript checks,
both production builds and the Cloudflare deployment dry run. CI validates both
apps and the standalone target.

Live checks verified anonymous public access, PostHog/Supabase queries, AI
investigations, zero differing canonical comparison counts and blocked public
write routes. The checked window contained **508 browser visitor profiles,
507 signed-in shopper accounts, 48 demo orders and USD 2,694 gross merchandise
revenue**. A public PowerPoint export downloaded with **20 slides, two editable
charts and two embedded workbooks**. These are observations from the verified
window, not hardcoded dashboard values.

```sh
npm test
```

## Demo recording status

**There is no current demo video.** Outdated finished videos, clips and raw
recordings have been removed from the project. A replacement will be recorded
only after the owner tests the updated app and requests it. Existing recording
helpers are legacy references and need updating before reuse; see
[recording status](docs/demo/README.md).

## Repository and documentation

| Path | Purpose |
| --- | --- |
| `sites/fieldwork-agent/` | Analytics UI, dictionary, readouts and public deployment target |
| `sites/fieldwork-supply/` | Separate storefront UI and backend routes |
| `platform/` | Canonical shared backend, sessions, telemetry, metrics and agent tools |
| `database/`, `supabase/migrations/` | Database definitions and versioned changes |
| `tests/` | Transaction, authorization, analysis, readout and public-boundary checks |
| `docs/` | Architecture, collection definitions and deployment instructions |
| `app.py`, `analysis_engine.py`, `readout_deck.py` | Earlier Streamlit prototype; not the public app runtime |

- [Workspace navigation and metric definitions](docs/analytics-workspace.md)
- [Website collection and source comparison](docs/website-collection.md)
- [USD product revenue](docs/product-revenue.md)
- [Agent intent handling](docs/agent-intent.md)
- [Detailed platform architecture](docs/platform_build.md)
- [Public resume hosting](docs/resume-hosting.md)
