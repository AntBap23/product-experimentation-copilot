WITH steps AS (
    SELECT device, week, session_id,
           min(event_order) FILTER (WHERE event_name = 'begin_checkout') AS checkout,
           min(event_order) FILTER (WHERE event_name = 'add_payment_info') AS payment,
           min(event_order) FILTER (WHERE event_name = 'purchase') AS purchase
    FROM events
    WHERE device = ? OR ? = 'All devices'
    GROUP BY device, week, session_id
)
SELECT week, count(*) AS checkout,
       count(*) FILTER (WHERE payment > checkout) AS payment,
       count(*) FILTER (WHERE purchase > payment AND payment > checkout) AS purchase
FROM steps
WHERE checkout IS NOT NULL
GROUP BY week
ORDER BY week
