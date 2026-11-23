# Analytics workspace

The workspace has five destinations: Overview, Ask AI, Experiments, Data Sources, and Data Dictionary. Commerce analysis is scoped to Website activity, using an explicit UTC start-inclusive/end-exclusive date range. Date edits take effect when Apply dates is selected. Experiments have their own cohort and dates.

## Source names and evidence

Only PostHog and Supabase are presented as data sources. PostHog provides browser visitors, native browser sessions, pageviews, behavioral interest and confirmed server events. Supabase provides signed-in shoppers, shopping sessions, carts, persisted orders and purchase-time line items. AI is a read-only analyst over these sources. Source configuration is distinguished from a successful current query, and missing/partial data stays visible.

Overview measures and answer evidence have source labels. Evidence drawers retain the selected result's own dates and cohort, query, returned rows and check time. Data Sources includes the canonical cross-source comparison; browser-only activity is excluded from that comparison.

## Data Dictionary

The searchable dictionary contains metrics, events, dimensions and experiment definitions. Entries include supported source systems, calculation, limitations, technical fields and an editable starting question. Search, source and type filters intersect. Commerce questions open in Ask AI without auto-submitting; experiment questions open in Experiments with the prompt filled.

Definitions distinguish browser profiles from shopper accounts, SDK sessions from application sessions, reach counts from a strict ordered funnel, and experiment units from visitor profiles. Revenue is gross merchandise revenue in USD from purchase-time line items; no refunds, tax or shipping are inferred. Unsupported satisfaction, lifetime-value and multi-touch attribution measures are called out.

The website_traffic tool exposes the same scoped PostHog browser query used by Overview to the agent. It is offered only for Website activity; malformed or incomplete results produce errors rather than fabricated zeros. Source citations use PostHog/Supabase names, with technical tool details retained in evidence.
