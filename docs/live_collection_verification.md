# Hosted storefront collection verification

Verified November 22, 2026, America/Chicago (records timestamped November 23 UTC).

Site: https://fieldwork-checkout-lab.bapnocap.chatgpt.site/

This test exercised the deployed website in a browser after passing its ChatGPT
access gate. No events were submitted through the synthetic seeder for this test.

## Evidence

The website's expanded Analytics event log showed event sequences 1 through 18
under session `885b73f2-d9bc-48e2-adf6-aff597bf07f1`. A PostHog MCP SQL query
returned all 18 matching events in order with `data_source=demo_store`.

| Sequence | Event | Expected and observed |
| --- | --- | --- |
| 1 | `$pageview` | Hosted page, guest identity |
| 2 | `view_item` | Guest product browsing |
| 3 | `demo_signed_in` | `fieldwork-demo-taylor` |
| 4–5 | `view_item`, `add_to_cart` | Summit Bottle |
| 6–8 | `begin_checkout`, `add_payment_info`, `purchase` | $28 order, one shared checkout ID |
| 9–12 | Two `view_item` and two `add_to_cart` events | Daypack and bottle |
| 13 | `remove_from_cart` | Daypack removed |
| 14–16 | `begin_checkout`, `add_payment_info`, `purchase` | $28 bottle order, separate checkout ID |
| 17 | `demo_signed_out` | Recorded under Taylor |
| 18 | `view_item` | New anonymous distinct ID after sign-out |

First checkout: `e98f08fa-c2f5-4177-9753-291ae757ba70`.
First transaction: `9aecc581-d7cf-4d7f-a98a-7dc53979e7cb`.

Second checkout: `8d73d090-3e85-472d-b5c2-e5f4d341c415`.
Second transaction: `ec9144de-6b33-4935-bf35-e585ab5e27d4`.

Guest distinct ID before sign-in: `01a20683-b3e0-7a74-be27-3120f4c0bf58`.
Guest distinct ID after sign-out: `01a20684-c25b-71b9-a89b-5f53fe5b3095`.

Browser console inspection returned no warning/error entries during these actions.

## Recheck with the MCP

```sql
SELECT
    event,
    timestamp,
    distinct_id,
    properties.event_sequence AS sequence,
    properties.checkout_id AS checkout_id,
    properties.auth_status AS auth_status,
    properties.value AS value,
    properties.transaction_id AS transaction_id
FROM events
WHERE timestamp >= '2026-11-23T03:40:00Z'
  AND timestamp < '2026-11-23T04:00:00Z'
  AND properties.data_source = 'demo_store'
  AND properties.demo_session_id = '885b73f2-d9bc-48e2-adf6-aff597bf07f1'
ORDER BY timestamp
LIMIT 50
```

## Scope

This verifies the explicitly instrumented shopping and identity events for these
two hosted journeys. It does not prove delivery from every visitor/browser,
untracked clicks, replay recording, or future changes. The in-page event log
alone proves only that tracking code ran; matching records in PostHog establish
that collection succeeded for this test.

Session recording and automatic click capture remain disabled. The 2,000-user
`synthetic_seed` dataset is separate and is not proof of browser collection.
