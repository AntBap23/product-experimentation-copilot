# Fieldwork Analytics

[Open the public app](https://fieldwork-analytics-demo.antbap23.workers.dev/).

This is the current React/TypeScript analytics application. Its five destinations
are **Overview**, **Ask AI**, **Experiments**, **Data Sources**, and **Data
Dictionary**. It queries PostHog and Supabase, attaches inspectable evidence to
answers, and exports editable experiment readouts for human review.

## Product behavior

- Overview separates PostHog browser profiles from Supabase shopper accounts and
  shows orders, USD revenue, product sales, and checkout step reach.
- Ask AI uses the OpenAI Responses API to choose approved read-only tools and
  explain their results. Dataset, dates, and query templates are server-owned.
- Experiments reviews the implemented control/variant test, source agreement,
  guardrails, segments, and uncertainty. Its cohort and dates are independent of
  commerce analysis.
- Data Sources shows only PostHog and Supabase. Evidence drawers expose queries,
  returned rows, source, scope, and check time.
- The dictionary searches 22 definitions and supplies editable starting questions.
- Readouts pin an experiment snapshot. Narrative and decision fields are editable;
  PowerPoint text, tables, and charts remain editable after download. Drafts save
  in the current browser.

## Run locally

From the repository root, install this app's locked dependencies, configure the
ignored root `.env`, and synchronize runtime configuration and shared modules:

```sh
npm --prefix sites/fieldwork-agent ci
npm run configure
npm run dev:analytics
```

The local analytics URL is `http://localhost:3000`. See the [root setup
guide](../../README.md#run-locally) for the database and server variables.
Missing connections produce visible errors; successful values are not fabricated.

## Deployment targets

The public app runs on **Cloudflare Workers**, without a visitor ChatGPT account:

```sh
npm --prefix sites/fieldwork-agent run build:resume
npm --prefix sites/fieldwork-agent run check:resume
npm --prefix sites/fieldwork-agent run deploy:resume
```

`vite.resume.config.ts`, `deploy/resume-worker.ts`, and `deploy/public-api.mjs`
define this target. It allows approved analytics routes and enforces persistent
usage quotas. Credentials belong in Worker secrets. The public interface hides
storefront preview links unless an accessible storefront URL is configured.

The ordinary `build` script retains the existing owner-private Sites target and
its authentication. The standalone target excludes the Sites auth and connector
plugins. Build the desired target immediately before deploying it; the standalone
deployment script rejects a private-Sites artifact.

## Source organization

- `app/page.tsx`: navigation, overview, agent conversation, sources, and evidence.
- `app/data-dictionary.ts`: metric definitions, questions, and source mapping.
- `app/experiments.tsx`: experiment results and investigations.
- `app/readout-editor.tsx` and `lib/readout/`: saved drafts and editable exports.
- `deploy/`: public API boundary and operational usage controls.
- `lib/platform/`: generated shared modules; edit root `platform/` instead.

See [workspace behavior](../../docs/analytics-workspace.md),
[architecture](../../docs/platform_build.md), and
[public deployment](../../docs/resume-hosting.md).
