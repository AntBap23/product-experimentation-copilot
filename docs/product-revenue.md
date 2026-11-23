# USD product revenue

Product revenue is gross merchandise revenue in USD: purchased quantity multiplied by the unit price recorded at purchase time. Cents are stored as integers and formatted as dollars in analyst answers. Shipping, tax and refunds are outside this demo measure.

## Supabase

Storefront orders already preserve currency in `fw_orders` and purchase-time quantity/price in `fw_order_items`. The USD contract is now enforced in the database. `fw_product_revenue(p_dataset,p_start,p_end)` returns ranked products, units, purchase counts, currency, total cents and provenance.

The historical imported fixture is mirrored in `fw_imported_purchases`, separate from application orders. Rows retain their confirmed PostHog event UUID, transaction ID, timestamp, USD total and normalized line items. Database checks reject invalid prices/quantities or line totals that do not add up. RLS and revoked public/anonymous/authenticated grants restrict access to the server credential. Imported events never become fake storefront orders.

Apply the two `product_revenue_usd` and `validate_usd_purchase_contract` migration files after the existing schema. Run `node scripts/backfill_imported_revenue.mjs` with the normal ignored server configuration to repeat the import idempotently. The script imports confirmed historical events, not regenerated guesses, and checks product totals against Supabase before succeeding.

## PostHog

Historical purchase events already contain USD and item arrays; no duplicate purchase stream is generated. The revenue reader uses timestamp/UUID keyset pagination, validates every order total, and deduplicates by transaction ID. Imported data uses `purchase`; application-flow data uses canonical backend `order_completed`, excluding browser `purchase` events so they cannot double revenue.

Future commerce captures also include explicit `revenue_cents`, item `unit_price_cents`, decimal `price`, `line_revenue_cents`, quantity and currency. Experiment copies retain their own measurement contract and are excluded from product-commerce revenue.

## Agent tools and verification

Both `product_revenue` (Supabase) and `product_revenue_posthog` are available for imported and application-flow datasets. Revenue questions use these tools rather than cart popularity, state USD and compare source totals. Dataset/date scope remains server-controlled. Missing currency, invalid totals, conflicting transaction copies or extraction above 20,000 events produce a visible failure instead of a partial ranking.

The import copied 1,492 confirmed historical purchases for October 1–November 24, 2026 UTC, end exclusive. For the user's October 27–November 24 window, independent queries agree on 1,445 purchases and:

| Product | Units | Revenue USD |
| --- | ---: | ---: |
| Ridge Daypack | 1,104 | $92,736.00 |
| Summit Bottle | 978 | $27,384.00 |
| Total | 2,082 | $120,120.00 |

Actual funded model checks answered “which products generate the most revenue” using both tools on the imported fixture and live demo orders. All purchases and payments remain synthetic/simulated. Raw responses stay in ignored `outputs/revenue-evals/`.
