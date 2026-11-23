# Fieldwork synthetic analytics dataset

Dataset ID: `fieldwork_synthetic_2000_v1`.

This is simulated behavior for development, imported into PostHog project **760509**.
It is not customer activity or evidence about an actual product. The six browser
demo accounts and earlier browser test sessions are separate from this dataset.
The storefront's account picker continues to expose those six interactive accounts;
the 2,000 seed profiles are analytics fixtures, not 2,000 authenticated accounts.

## Contents

- 2,000 stable fictional identities, `fieldwork-synth-v1-0001` through `fieldwork-synth-v1-2000`.
- 5,790 visits over October 26–November 22, 2026, inclusive, using UTC dates.
- 32,803 total events, including 2,000 `$identify` profile events.
- 1,492 simulated orders, with unique transaction IDs and item-level quantities/prices.
- Mobile/desktop, organic/email/paid search/social, new/returning visit segments.
- Both catalog products, mixed baskets, multiple quantities, cart removals,
  checkout abandonment, and simulated payment errors.

All events have `is_synthetic=true`, `is_demo=true`,
`data_source=synthetic_seed`, `generation_method=scripted_simulation`, and
`dataset_id=fieldwork_synthetic_2000_v1`. Person profiles also have the dataset
and synthetic flags. No real names, emails, passwords, or payment information
are generated. Profile names are `Synthetic Shopper 0001`, etc.

Each visit has a UUIDv7 session ID in both the native session field and
`demo_session_id`. Checkout events share a `checkout_id`; purchases carry
`transaction_id`. Users retain their distinct ID across visits. These fixtures
represent signed-in activity; anonymous-to-known stitching is tested separately
through the browser demo.

## Ground truth and assumptions

The generator deliberately changes the mobile checkout-to-payment probability
from 80% to 50% during **November 16–22 UTC**. Desktop probability remains 80%.
Observed rates differ due to seeded random sampling. Conversion after reaching
payment is generated at 87%. A subset of failed recent mobile checkouts emits
`payment_error` with `error_code=synthetic_payment_validation`.

This is a planted observational pattern, not a randomized experiment or a causal
effect estimate. Device and acquisition channel are assigned synthetic attributes;
the generator does not impersonate device browsers, geographies, or real people.
PostHog may enrich imported records with the uploader's IP/geography. Those
automatic geo fields describe the import source, not shopper locations, and
must not be used for geographic customer analysis of these fixtures.
New/returning is relative to this dataset. Sessions are defined by each simulated
visit rather than inferred inactivity. No refund or payment-error guardrails for
an actual experiment are available.

## Reproduce or resume

Generate and validate locally, without network access:

```sh
python3 scripts/seed_posthog.py
```

Import to the connected US project:

```sh
python3 scripts/seed_posthog.py --upload
```

The uploader reads `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` from the environment
or the storefront's ignored `.env`. It uses the official
[Capture v1 API](https://posthog.com/docs/api/capture-v1) with historical migration
enabled and validates every event's response. It sends batches of 500.

Generated events, a manifest, and the accepted-event checkpoint live in the
ignored `data/fieldwork_synthetic_2000_v1/` directory. Preserve that checkpoint:
rerunning skips accepted event IDs. Stable event UUIDs are retained for retries,
but do not assume remote deduplication makes deleting the checkpoint safe.
The dataset dates, seed, IDs, and event order are fixed; do not change generator
logic under the same dataset ID after importing. Use a new dataset version for
future changes.

Validation checks unique users/event IDs, valid UUIDv7 IDs, bounded timestamps,
ordered checkout stages, shared checkout IDs, and order totals matching line items.

## Asking the MCP

### Import verification

Verified through the connected PostHog MCP on November 22, 2026 (America/Chicago):

| Check | Stored value |
| --- | ---: |
| Event rows | 32,803 |
| Unique event UUIDs | 32,803 |
| Distinct shopper IDs | 2,000 |
| Distinct person profiles | 2,000 |
| Distinct visit IDs | 5,790 |
| Purchases | 1,492 |

All values match the local manifest. The initial accepted upload was missing
331 stored events belonging to 22 users. Targeted resends retained the original
UUIDs and timestamps; the final audit confirmed complete storage without duplicate
event UUIDs. Local repair checkpoints record those resends. A successful capture
response alone is not sufficient evidence of a complete import.

The repeatable [audit query](../sql/posthog_seed_audit.sql) reconciles this fixture.

Always specify **dataset `fieldwork_synthetic_2000_v1`**, the date range, and UTC.
Use event-level dataset filters so earlier manual tests do not contaminate results.
Use PostHog persons for unique-user analysis and session/checkout IDs for funnels
whose unit is a visit or attempt. Avoid treating multiple visits as new people.

Example questions:

- How many distinct synthetic shoppers and visits are in this dataset?
- Compare mobile and desktop checkout-to-payment conversion for November 9–15
  versus November 16–22 UTC. Show denominators and the biggest change.
- Which acquisition channels generate the most purchasing users?
- Compare new and returning visits and purchase rates.
- Which product appears most often in orders, and how much simulated revenue
  does each product contribute? Use line items for mixed baskets.

For a later analytics app, calculate results from PostHog queries and retain the
query, dataset filter, time boundaries, metric unit, and returned evidence.
Do not substitute these ground-truth generation probabilities for observed counts.
