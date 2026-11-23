-- Run in the authorized Supabase SQL editor. Adjust UTC bounds for live traffic.
select public.fw_experiment_analytics('fieldwork_experiment_2000_v1','2026-11-09','2026-11-23');

select a.dataset_id,a.unit_id,a.variant,a.assigned_at,a.first_exposure_at,
 count(e.id) filter(where e.event='experiment_exposure') as exposures,
 count(e.id) filter(where e.event='purchase') as purchase_events,
 sum(o.total_cents) filter(where e.event='purchase') as database_revenue_cents
from public.fw_experiment_assignments a
left join public.fw_experiment_events e using(experiment_id,dataset_id,unit_id)
left join public.fw_orders o on o.id=e.order_id
where a.dataset_id='fieldwork_experiment_live_v1'
 and a.first_exposure_at >= '2026-11-22' and a.first_exposure_at < '2026-11-24'
group by a.dataset_id,a.unit_id,a.variant,a.assigned_at,a.first_exposure_at
order by a.variant,a.unit_id;

select e.dataset_id,ob.state,count(*) as events
from public.fw_experiment_outbox ob join public.fw_experiment_events e on e.id=ob.event_id
group by e.dataset_id,ob.state;
