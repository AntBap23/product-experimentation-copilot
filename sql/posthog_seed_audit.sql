-- HogQL for an operational fixture reconciliation, not a reusable product metric.
-- Expected: 32803 events, 2000 IDs/profiles, 5790 visits, 1492 orders.
SELECT
    count() AS stored_events,
    count(DISTINCT uuid) AS unique_event_ids,
    count(DISTINCT distinct_id) AS shopper_ids,
    count(DISTINCT person_id) AS person_profiles,
    count(DISTINCT properties.demo_session_id) AS visits,
    countIf(event = 'purchase') AS purchases,
    min(timestamp) AS first_event,
    max(timestamp) AS last_event
FROM events
WHERE timestamp >= '2026-10-26T00:00:00Z'
  AND timestamp < '2026-11-23T00:00:00Z'
  AND properties.dataset_id = 'fieldwork_synthetic_2000_v1'
