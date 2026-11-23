# Fieldwork Analytics workspace

A separate analytics application built with React and Vinext. Includes a dashboard,
chat, source configuration states and an evidence drawer. Server routes use fixed
read-only analytics tools against Supabase and PostHog.

From the workspace root, configure the ignored `.env`, run
`node scripts/configure_apps.mjs`, then start `npm run dev:analytics`.
Hosted runtime secrets must be configured separately through Sites.

With no model credential the UI explicitly shows Guided analysis. Missing data
connections return visible errors and empty states. No placeholder metric values
are presented as measured results. The storefront remains a separate Site.
