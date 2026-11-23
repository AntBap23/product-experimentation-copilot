# Checkout metric definitions

## Product question

Where did checkout conversion fall, and which step and device account for the change?

## Current demo

| Metric | Numerator | Denominator |
| --- | --- | --- |
| Checkout-to-payment conversion | Checkout sessions that reach an ordered payment step | Sessions with a checkout start |
| Checkout-to-purchase conversion | Checkout sessions that reach purchase after payment | Sessions with a checkout start |
| Payment-to-purchase conversion | Checkout sessions that reach purchase after payment | Checkout sessions that reach an ordered payment step |

The demo groups by synthetic week, device, and session ID. It uses the first occurrence of each event and checks the order using event positions. The data has no calendar timestamps or conversion window. The separate experiment scenarios use assigned users as the denominator.

## Decisions for the first event-backed analysis

- **Unit of analysis.** Start with checkout sessions as in the demo, or measure unique checkout starters if the product question is about people across multiple visits.
- **Eligibility and device.** Specify which checkout starts qualify and how to attribute a shopper who switches devices.
- **Time window.** Specify week boundaries, the time zone, the time allowed to purchase, and how recent cohorts get a full observation window.
- **Repeated events.** Specify how to handle duplicate event IDs, checkout retries, and events with tied timestamps.

Once those choices are set, generate dated synthetic events with a planted mobile payment drop-off. Verify that the SQL reproduces the expected counts. In the case study, quantify the affected volume and use the result to motivate a test of a specific payment-flow change.
