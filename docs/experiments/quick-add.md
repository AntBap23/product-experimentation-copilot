# Quick add — live experiment queries

The experiment workspace now queries Supabase or PostHog on every refresh. It does not load bundled result JSON. Select the source and cohort at the top of the screen; inspect query text, returned aggregates, timestamps, and the independent comparison under **Method & evidence**.

## What changed on the store

Control A opens product details before Add to bag. Treatment B has a direct Add to bag button on the product card and explains the fictional-account requirement. Prices and payment behavior are unchanged. This is a custom-coded experiment, not a native PostHog feature flag.

| A | B |
|---|---|
| ![Control](screenshots/products-A.png) | ![Treatment](screenshots/products-B.png) |

## Two separate cohorts

| Dataset | Origin | Storage | Interpretation |
|---|---|---|---|
| `fieldwork_experiment_2000_v1` | 2,000 fictional visitors, 9,126 scripted events | Identical event UUIDs and properties in Supabase and PostHog | Deliberately planted effect; not real business lift |
| `fieldwork_experiment_live_v1` | Actual interactions with the demo store after this upgrade | Persisted assignments, exposures, session links and attributed commerce events; delivered to PostHog through an outbox | Live interaction data, fictional accounts and simulated payment |

The synthetic fixture is event-only. Its 325 purchases were **not** inserted into the commerce orders table. The new live-demo purchase events reference actual `fw_orders` records, with totals computed by the database.

Historical traffic predating assignment persistence is not retroactively attributed.

## Live data path

1. The browser keeps a visitor UUID in localStorage. Before rendering the product cards, the server asks Supabase to create or return its immutable assignment. PostgreSQL and JavaScript use the same deterministic 50/50 hash.
2. The browser reports the first visible catalog exposure and non-commerce engagement through a server endpoint. Supabase deduplicates exposure for that visitor. Preview overrides make no assignment, event or checkout requests.
3. Demo sign-in links the commerce session to that existing assignment. Switching fictional accounts does not change the visitor variant. A session cannot be reassigned to a different visitor.
4. A database trigger copies signed-in commerce events into the experiment stream in the same transaction. Purchase attribution requires an existing order owned by that session/user. Browser capture endpoints cannot submit purchases, revenue, or cart/checkout outcomes.
5. Experiment copies of commerce events receive deterministic UUIDs distinct from the original commerce UUIDs, with `commerce_event_id` retaining the link. A transactional experiment outbox delivers the same experiment event IDs to PostHog using `experiment_backend` as the source. Failed delivery stays pending; later requests or the explicit retry endpoint retry it. No scheduled worker is claimed.
6. The analytics app queries `/api/experiments`. It executes a Supabase RPC and bounded PostHog queries, returning the selected result plus an independent aggregate comparison. No provider error falls back to a fixture or fabricated zero metrics.

## Reproduce in Supabase

Run as an authorized database owner in the SQL editor:

```sql
select public.fw_experiment_analytics(
  'fieldwork_experiment_2000_v1',
  '2026-11-09T00:00:00Z',
  '2026-11-23T00:00:00Z'
);
```

For live demo interactions, use `fieldwork_experiment_live_v1` and a UTC date window covering the visits. The end is exclusive. [Audit queries](../../sql/experiment_audit.sql) inspect immutable assignments, exposure deduplication, purchase/order linkage, and delivery state.

New server-only tables: `fw_experiment_assignments`, `fw_experiment_sessions`, `fw_experiment_events`, and `fw_experiment_outbox`. RLS is enabled, browser roles have no direct grants, and RPCs use `security invoker` with an empty search path. Apply `database/schema.sql` first and then `database/experiments.sql` for a fresh manual setup. The CLI-created additive migration is in `supabase/migrations/20261123054707_live_experiment_queries.sql`; the hosted schema was iterated through explicit SQL rather than pretending migration history exists.

## Reproduce in PostHog

[SQL for the synthetic variant totals](../../sql/posthog_experiment.sql) is the same source query used by the server. For live data, use the [live-cohort SQL](../../sql/posthog_experiment_live.sql) and adjust its UTC bounds. PostHog queries filter `experiment_id=fw_quick_add_v1` and authoritative sources `experiment_synthetic_seed` / `experiment_backend`, so the separate browser and canonical commerce streams are not double-counted. Live commerce copies require their `commerce_event_id` link; obsolete QA copies from before the distinct-ID correction are excluded. Guest product views remain eligible.

The unit is `experiment_unit_id`, **not** the six shared demo-account person IDs. Queries join each visitor's first exposure to later outcomes, then aggregate per visitor and segment. Queries run sequentially to respect provider concurrent-query limits. A missing key, rejected query, incomplete response, or truncated response is visible as unavailable; it is not a successful empty result.

## Metric definitions

- Primary: exposed visitors with at least one subsequent purchase / exposed visitors.
- Product: product engagement, shopping CTA engagement, added-to-cart and checkout visitors, simulated gross revenue.
- Web: device/channel segments and custom no-product-engagement proportion. That proportion is not native PostHog session bounce rate.
- Guardrail: visitors with a payment error / visitors reaching checkout.
- Exposure cohorts are selected by **first exposure** in the query window. Later outcomes are included only before its exclusive end. Repeated purchases contribute revenue but count once for visitor conversion.
- Assignment is browser/visitor level. Clearing storage or using another device creates a new unit. No cross-device person attribution is claimed.
- The normal 95% difference interval is suppressed for sparse samples. It assumes independent visitors, and has no sequential or multiple-comparison adjustment. Live exploratory views are not a preregistered shipping test.
- Comparison checks raw event counts and all displayed metric/segment aggregates. Matching totals are aggregate parity, not a full event-by-event audit. Delivery lag can temporarily produce differences.

## Verification

Fresh queries from both sources reproduce A: 946 visitors, 118 purchases, $7,000; B: 1,054 visitors, 207 purchases, $11,732. Synthetic comparison reports no aggregate differences.

Real local-browser checkouts after the persistence upgrade produced:

| Variant | Visitor | Database order | Amount |
|---|---|---|---:|
| A | `c312e961-dbbf-4478-a9a9-1e97ccfc287a` | `1499ab42-fca2-4712-861f-b5b5a3e4c0c6` | $84 |
| B | `21ec063b-d43d-465a-b81f-0d25d938dcf2` | `6f638103-3516-4d83-9ba9-70d109fae05a` | $28 |

Each retains exactly one exposure after reload. At the initial QA snapshot, the live stream contained 23 events from these journeys (subsequent visits can add events); both sources return the same two visitor conversions and revenue. The sample is intentionally too small for an interval or a shipping recommendation.

Actual Chrome checks cover source switching, synthetic/live cohorts, channel segmentation, sparse states, no bundled-data requests, stable assignment after reload, both checkout paths, preview exclusion, and mobile overflow. Twelve automated tests cover transactional ownership/idempotency, signed cookies, restricted model tools, import deduplication, immutable attribution, browser purchase rejection, role isolation, and source mismatch detection. All credentials remain server-only. Live OpenAI generation still needs billing credits; query/refresh does not call the model.

[Supabase query screenshot](screenshots/live-supabase.png) · [PostHog query screenshot](screenshots/live-posthog.png) · [Live demo cohort](screenshots/live-demo.png) · [Mobile](screenshots/live-mobile.png)
