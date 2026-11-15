# Product Experimentation Copilot

A local-first tool for product analysts to investigate metric changes, turn findings into testable hypotheses, and monitor active A/B tests.

## First demo

Use a synthetic checkout dataset with a planted mobile drop-off at the payment step and a simulated experiment. The first question is “Where did checkout conversion fall this week?” Return a funnel comparing two complete weeks, with conversion counts, eligible-user denominators, device breakdowns, and the SQL behind the answer. The demo should surface the planted drop-off and explain how it was measured.

## Build order

1. **Define the data.** Generate synthetic events with event ID, user ID, UTC timestamp, event name, and device. Add experiment assignments with experiment ID, user ID, variant, and assignment timestamp. Define the funnel's eligibility, sequence, conversion window, and deduplication rules in a metric catalog.
2. **Build the checkout analysis.** Use parameterized DuckDB SQL to calculate step conversion by device and week. Display counts, rates, date windows, and query text in Streamlit. Verify the results against known synthetic counts and handle empty or incomplete periods explicitly.
3. **Produce an opportunity brief.** Rank observed gaps by volume and size. For a mobile payment drop-off, report the affected volume and baseline, propose a plausible cause, and draft a hypothesis, primary metric, and guardrails. Label impact scenarios with their assumptions and keep causal claims for randomized results.
4. **Monitor an ongoing A/B test.** Start with one binary user-level metric and a predeclared fixed-horizon analysis. Use the randomized unit as the denominator and give each arm the same outcome window. Show arm counts, data freshness, sample-ratio mismatch, guardrails, and the interval for the primary effect at the planned readout. Use interim views for operational checks. If early decisions are required later, adopt a prespecified sequential design.
5. **Add the agent.** Route natural-language questions to approved functions such as `compare_funnel`, `draft_test_brief`, and `experiment_health`. Validate arguments and return structured results. Let code calculate metrics and let the model select tools and explain returned evidence. Log the tool, parameters, data window, and results so analysts can reproduce any answer. Use templated summaries when the model is unavailable.
6. **Pilot with a work data source.** Map one approved export or read-only warehouse view to the same schema. Validate metric parity against an existing dashboard before expanding to additional funnels. Keep raw work data and credentials outside the repository.

## Free tools

| Tool | Role | Cost boundary |
| --- | --- | --- |
| [DuckDB](https://duckdb.org/faq) | Query local CSV or Parquet data | Open source, runs locally |
| [Streamlit](https://github.com/streamlit/streamlit) | Build the local analyst UI | Open-source framework |
| [SciPy](https://scipy.org/) | Statistical routines for experiment checks | Open-source library |
| [Ollama](https://docs.ollama.com/api/introduction) | Optional local model for tool selection and summaries | Local API needs no key. Model performance depends on hardware |
| [PostHog](https://posthog.com/pricing) | Optional event collection and experiments for a demo product | 1M analytics events and 1M flag requests monthly on the free allowance. Experiments use the flag allowance |

The first demo runs on a laptop with synthetic data and requires no hosted service.
