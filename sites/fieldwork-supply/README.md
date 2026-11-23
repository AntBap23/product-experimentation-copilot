# Fieldwork Supply

Fieldwork Supply is the separate demo storefront that produces activity for the
analytics platform. It is a server-backed React/Vinext app serving its shop from
`public/store/`. Its existing hosted deployment is owner-private.

## Current shopping flow

The catalog loads **12 active products** from Supabase. A shopper can open product
details, add or remove items, begin checkout, select demo payment, and save an
order. The database controls product prices and purchase-time line items.
Carts, checkout states, orders, canonical events, and event-delivery records are
persisted through backend functions. Request IDs make repeated actions idempotent.

The account dialog supports preset demo shoppers and **Start a new visitor**.
A new visitor receives a server-issued profile and signed session. A signed,
expiring HttpOnly cookie identifies the backend session; reload restores its
shopper and cart. Switching profiles resets browser identity and shopping state.
This is demo sign-in, not password-based customer authentication. Payments do
not charge a card.

## Collection and source comparison

The official PostHog browser SDK captures explicit pageviews, product views,
cart/checkout interactions, scroll depth, and links. Signed-in application
actions and orders also persist in Supabase. A transactional outbox forwards
canonical server events to PostHog with stable event/order IDs.

| Supabase canonical event | Forwarded PostHog event |
| --- | --- |
| `view_item` | `view_item` |
| `add_to_cart` | `add_to_cart` |
| `begin_checkout` | `begin_checkout` |
| `add_payment_info` | `add_payment_info` |
| `purchase` | `order_completed` |

The separate browser `purchase` event is behavioral telemetry. It is not added
to canonical server purchases when counting orders or revenue. Browser events
use `data_source=demo_store`; canonical server events use `store_backend`.
Website activity is scoped to `fieldwork_live_v2`. Anonymous browser activity
and signed-in application records have different coverage.

Capture configuration comes from `/api/store/analytics-config`, which exposes
only the public capture token and ingest host. An ignored generated
`analytics-config.js` file is not required. SDK readiness is handled before
identity changes and event capture. Autocapture and session recording are
currently disabled.

## Included experiment

Control A opens product details before a shopper adds to the bag. Variant B
adds an **Add to bag** button on product cards. The backend persists assignments,
exposures, and signed-in attribution. `?experiment_preview=A` or
`?experiment_preview=B` shows the reference design with collection and shopping
mutations disabled. Preview traffic is excluded from experiment results.

## Local development

From the repository root, configure `.env` and install the locked dependencies:

```sh
npm --prefix sites/fieldwork-supply ci
npm run configure
npm run dev:store
```

The local shop is `http://localhost:3001`. It needs the Supabase server settings,
PostHog capture settings, and `SESSION_SECRET` described in the
[root README](../../README.md#run-locally). Production runtime settings are
configured separately from local `.dev.vars` files.

Edit `public/store/` for storefront content and browser behavior, `app/api/` for
its route integration, and root `platform/` for shared server logic. `dist/` is
generated output; do not edit it or serve it as the old static-only prototype.
The current app uses the framework development/build scripts.

## Verification

Check a product view, cart addition/removal, completed demo purchase, abandoned
checkout, profile change, and reload. Verify the saved order/lines in Supabase
and the confirmed corresponding events in PostHog. Capture acceptance alone is
not proof that an event is queryable. Delayed delivery remains pending and can
be retried through the authenticated backend; the public analytics Worker does
not expose write or retry routes.

See [collection definitions](../../docs/website-collection.md) and
[architecture](../../docs/platform_build.md).
