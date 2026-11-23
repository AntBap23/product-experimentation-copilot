-- Run in BigQuery to inspect one week of the public GA4 ecommerce export.
SELECT
    event_date,
    event_name,
    COALESCE(device.category, '(missing)') AS device_category,
    COUNT(*) AS event_count,
    COUNTIF(user_pseudo_id IS NULL) AS events_without_user_id,
    COUNTIF(NOT EXISTS (
        SELECT 1
        FROM UNNEST(event_params) AS parameter
        WHERE parameter.key = 'ga_session_id'
          AND parameter.value.int_value IS NOT NULL
    )) AS events_without_session_id
FROM `bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20210110' AND '20210116'
  AND event_name IN (
      'page_view', 'view_item', 'add_to_cart', 'begin_checkout',
      'add_shipping_info', 'add_payment_info', 'purchase'
  )
GROUP BY event_date, event_name, device_category
ORDER BY event_date, event_name, device_category;
