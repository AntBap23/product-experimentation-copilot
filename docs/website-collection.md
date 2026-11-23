# Website collection and source comparison

The default analytics view is **Website activity**, scoped to `fieldwork_live_v2`. It measures actual browser interactions, not generated shoppers. Website visitor counts come from PostHog browser identities; signed-in shoppers are separate Supabase account counts. Repeated clicks or visits by one browser do not create a new unique visitor for every event. Checkout still uses demo payments.

## Explicit data layer

The storefront records pageviews, product views, product CTA interactions, cart additions/removals, checkout progression, payment errors, orders, scroll-depth milestones and link clicks. Shared event dimensions include page name/type/path, shop section, referrer domain, UTM source/medium/campaign, browser, OS, screen dimensions, language and visitor context. URLs exclude query strings/fragments and no raw user-agent string is retained in the shared context. Acquisition context is preserved for the browser tab; Supabase sessions retain entry context. This is a documented custom attribution model, not Adobe's complete eVar allocation/expiration implementation.

This follows the measurement-plan pattern used in Adobe Analytics: page/content dimensions, campaign dimensions, explicit success events and purchase-time product line items. PostHog event properties play the dimension role; it does not become an Adobe report suite. Geo, cross-device identity, refunds, marketing attribution models and unimplemented performance metrics are not inferred.

## Two sources, different jobs

PostHog browser events include anonymous visitors, pageviews, scrolls and clicks. Supabase stores signed-in sessions, canonical actions, carts and transaction-safe order line items. Atomic server events and their context are persisted in Supabase and forwarded through its outbox to PostHog with stable event and transaction identifiers. Revenue remains USD.

**Compare sources** compares only the matching canonical application-event cohort in the selected UTC window, by event, device, acquisition channel and page: event counts, distinct user IDs and demo-session IDs. Guest/browser-only activity is excluded from this parity calculation. PostHog `order_completed` maps to Supabase `purchase`, and duplicate browser purchase events are excluded. Differences remain visible during ingestion lag. Aggregate equality does not replace a record-level audit; order reconciliation remains available separately. Native PostHog sessions and signed-in application sessions need not have the same boundaries.

## Generated traffic stopped

The owner stopped the earlier generation request after 2,000 fictional shoppers had completed 4,000 application sessions. Those records remain isolated in `fieldwork_flow_v1`, absent from the website selector and website traffic queries. Remaining outbox delivery is explicitly suppressed; already captured generated events retain their separate dataset rather than being renamed into genuine traffic. No generator or recurring simulation remains running.

## Live browser verification and expanded catalog

The store now has 12 active products, supplied by the `fw_catalog` server query instead of a hardcoded browser list. Prices remain database-authoritative. Purchase events include product IDs, names, categories, quantities, USD purchase-time prices and line revenue, allowing independent product-revenue queries in both sources.

Browser capture configuration is loaded from the deployed `/api/store/analytics-config` endpoint, which returns only the public capture token and ingest host. The ignored local `analytics-config.js` file is no longer a deployment dependency. SDK initialization is awaited/queued so missing capture methods cannot break sign-in or checkout. The automated visit workflow operates the published site through its actual UI; it does not insert visit rows or upload spreadsheet data. Browser/operator visits are not evidence of real-customer demand.
