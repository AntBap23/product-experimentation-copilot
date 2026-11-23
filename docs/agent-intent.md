# Interpreting ordinary analytics questions

Fieldwork accepts business language rather than requiring metric names. Its analyst instructions translate a vague ask into measurable proxies, state the interpretation, inspect supported evidence, and explain what that evidence cannot establish. It asks one focused clarification when competing interpretations materially change the conclusion and there is no reasonable default.

For “what products do users like most”, the agent compares distinct product viewers and distinct cart users from confirmed PostHog events. Application-flow datasets additionally support purchased units and revenue from Supabase orders. These signals are reported separately; no arbitrary popularity score is invented. Behavior does not establish stated preference, satisfaction or ratings.

The product-interest query is server-owned. It is bounded to the selected dataset and UTC date window (end exclusive), uses exact distinct event identifiers, and returns at most 50 products ranked by cart users and then viewers. Viewers and cart users are independent window counts: a shopper may add directly to a cart without a recorded product view, so their ratio is not a sequenced conversion rate. Delivery lag can omit activity from PostHog.

## Dataset capabilities

- Imported event-only fixture: overview and behavioral product interest.
- Application-flow datasets: overview, product interest, persisted product sales, checkout funnel, daily orders, acquisition channels and order reconciliation.
- Experiment cohorts: experiment metrics and independent PostHog/source-reconciliation tools.

Only supported tools are offered to the model. The server also rejects unsupported calls even if a model requests one. Dataset/date arguments remain server-owned, with no model SQL or writes. The agent never silently changes datasets to find an answer. Tool failures remain visible and are not converted into invented metrics.

## Verification

Bounded live checks used the existing configured OpenAI integration against the October 27–November 24, 2026 UTC window:

- The exact popularity question on the imported fixture selected `product_interest`, explained its behavioral interpretation, and compared 1,826/1,790 distinct viewers and 1,349/1,325 cart users. It reported a narrow daypack lead, with the synthetic-data and satisfaction limitations.
- The same question on live demo flows selected product interest and persisted product sales, noted the tiny sample, and distinguished views, cart users and purchased units.
- “What is going wrong with the shop?” selected overview, funnel, daily and channel evidence. It explained its diagnostic interpretation, found insufficient activity to diagnose a fault, and avoided fabricating a checkout problem.

These checks are examples of model behavior, not a guarantee for all wording. The raw responses stay in ignored `outputs/intent-evals/`. Tests cover query scope, independent signal semantics, supported capabilities and rejection of unsupported model tool calls. The UI renders tables and emphasis using React text nodes rather than executing model HTML.
