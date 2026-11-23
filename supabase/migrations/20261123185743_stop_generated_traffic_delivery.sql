alter table public.fw_event_outbox add column delivery_suppressed boolean not null default false;
update public.fw_event_outbox o set delivery_suppressed=true,last_error='Generated traffic delivery stopped by owner' from public.fw_events e where e.id=o.event_id and e.dataset_id='fieldwork_flow_v1';
create or replace function public.fw_claim_events(p_limit integer default 50) returns setof public.fw_events language sql security invoker set search_path='' as $$
 with selected as (select event_id from public.fw_event_outbox where not delivery_suppressed and (state='pending' or (state='processing' and updated_at<now()-interval '2 minutes')) order by updated_at for update skip locked limit least(greatest(p_limit,1),500)),claimed as(update public.fw_event_outbox o set state='processing',attempts=attempts+1,updated_at=now() from selected where o.event_id=selected.event_id returning o.event_id)select e.* from public.fw_events e join claimed on e.id=claimed.event_id;
$$;
