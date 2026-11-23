-- Additive experiment storage. Run after database/schema.sql.
begin;
create table public.fw_experiment_assignments (
 experiment_id text not null check(experiment_id='fw_quick_add_v1'),
 dataset_id text not null check(dataset_id in ('fieldwork_experiment_2000_v1','fieldwork_experiment_live_v1')),
 unit_id text not null, variant text not null check(variant in ('A','B')),
 device text not null check(device in ('Mobile','Desktop')), channel text not null check(channel in ('organic','email','paid_search','social')),
 assigned_at timestamptz not null, first_exposure_at timestamptz,
 primary key(experiment_id,dataset_id,unit_id)
);
create index fw_experiment_cohort on public.fw_experiment_assignments(dataset_id,experiment_id,first_exposure_at);
create table public.fw_experiment_sessions (
 session_id uuid primary key references public.fw_sessions(id), experiment_id text not null,
 dataset_id text not null, unit_id text not null,
 foreign key(experiment_id,dataset_id,unit_id) references public.fw_experiment_assignments
);
create index fw_experiment_session_unit on public.fw_experiment_sessions(experiment_id,dataset_id,unit_id);
create table public.fw_experiment_events (
 id uuid primary key, experiment_id text not null, dataset_id text not null, unit_id text not null,
 event text not null, occurred_at timestamptz not null, properties jsonb not null,
 order_id uuid references public.fw_orders(id),
 foreign key(experiment_id,dataset_id,unit_id) references public.fw_experiment_assignments
);
create index fw_experiment_event_window on public.fw_experiment_events(dataset_id,occurred_at,event);
create index fw_experiment_event_unit on public.fw_experiment_events(experiment_id,dataset_id,unit_id,occurred_at);
create unique index fw_experiment_one_exposure on public.fw_experiment_events(experiment_id,dataset_id,unit_id) where event='experiment_exposure';
create index fw_experiment_order_lookup on public.fw_experiment_events(order_id);
create unique index fw_experiment_one_order on public.fw_experiment_events(experiment_id,order_id) where order_id is not null;
create table public.fw_experiment_outbox (
 event_id uuid primary key references public.fw_experiment_events(id),
 state text not null default 'pending' check(state in ('pending','processing','sent')),
 attempts integer not null default 0, updated_at timestamptz not null default now(), last_error text
);
create index fw_experiment_outbox_pending on public.fw_experiment_outbox(state,updated_at);
create function public.fw_experiment_variant(p_unit text) returns text language plpgsql immutable security invoker set search_path='' as $$
declare n bigint:=2166136261; c text; begin
 for c in select regexp_split_to_table('fw_quick_add_v1:'||p_unit,'') loop
 n:=((n # ascii(c)) * 16777619) % 4294967296;
 end loop;
 return case when n<2147483648 then 'A' else 'B' end;
end $$;
create function public.fw_experiment_assign(p_unit text,p_device text,p_channel text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.fw_experiment_assignments; begin
 if p_unit !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then raise exception 'Invalid visitor UUID'; end if;
 insert into public.fw_experiment_assignments values('fw_quick_add_v1','fieldwork_experiment_live_v1',p_unit,public.fw_experiment_variant(p_unit),p_device,p_channel,now(),null) on conflict do nothing;
 select * into strict a from public.fw_experiment_assignments where experiment_id='fw_quick_add_v1' and dataset_id='fieldwork_experiment_live_v1' and unit_id=p_unit;
 return to_jsonb(a);
end $$;
create function public.fw_experiment_link(p_user text,p_session uuid,p_unit text) returns void language plpgsql security invoker set search_path='' as $$
declare linked text; begin
 if not exists(select 1 from public.fw_sessions where id=p_session and user_id=p_user and dataset_id='fieldwork_live_v2' and ended_at is null) then raise exception 'Invalid live shopping session'; end if;
 insert into public.fw_experiment_sessions values(p_session,'fw_quick_add_v1','fieldwork_experiment_live_v1',p_unit) on conflict do nothing;
 select unit_id into strict linked from public.fw_experiment_sessions where session_id=p_session;
 if linked<>p_unit then raise exception 'Session already belongs to another visitor; sign in again'; end if;
end $$;
create function public.fw_experiment_after_event() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.event='experiment_exposure' then
 update public.fw_experiment_assignments set first_exposure_at=least(coalesce(first_exposure_at,new.occurred_at),new.occurred_at)
 where experiment_id=new.experiment_id and dataset_id=new.dataset_id and unit_id=new.unit_id;
 end if;
 if new.dataset_id='fieldwork_experiment_live_v1' then insert into public.fw_experiment_outbox(event_id) values(new.id); end if;
 return new;
end $$;
create trigger fw_experiment_event_inserted after insert on public.fw_experiment_events for each row execute function public.fw_experiment_after_event();
create function public.fw_experiment_capture(p_unit text,p_event text,p_request uuid,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.fw_experiment_assignments; existing public.fw_experiment_events; props jsonb; begin
 if p_event not in ('$pageview','experiment_exposure','view_item','view_item_list','product_cta_clicked') then raise exception 'Browser cannot submit commerce experiment outcomes'; end if;
 select * into strict a from public.fw_experiment_assignments where experiment_id='fw_quick_add_v1' and dataset_id='fieldwork_experiment_live_v1' and unit_id=p_unit for update;
 select * into existing from public.fw_experiment_events where id=p_request;
 if found then
  if existing.unit_id<>p_unit or existing.event<>p_event or existing.dataset_id<>a.dataset_id then raise exception 'Event ID reused'; end if;
  return jsonb_build_object('event_id',existing.id,'variant',a.variant,'replayed',true);
 end if;
 if p_event='experiment_exposure' then
 select * into existing from public.fw_experiment_events where experiment_id=a.experiment_id and dataset_id=a.dataset_id and unit_id=p_unit and event=p_event;
 if found then return jsonb_build_object('event_id',existing.id,'variant',a.variant,'replayed',true); end if;
 end if;
 props:=jsonb_build_object('experiment_id',a.experiment_id,'dataset_id',a.dataset_id,'variant',a.variant,'experiment_unit_id',p_unit,'allocation_unit','visitor','device',a.device,'$device_type',a.device,'acquisition_channel',a.channel,'is_demo',true,'is_synthetic',true,'data_source','experiment_backend','generation_method','application_flow');
 if p_data->>'item_id' in ('ridge-22','summit-750') then props:=props||jsonb_build_object('item_id',p_data->>'item_id'); end if;
 if p_data->>'cta' in ('quick_add','view_details','details_add') then props:=props||jsonb_build_object('cta',p_data->>'cta'); end if;
 insert into public.fw_experiment_events values(p_request,a.experiment_id,a.dataset_id,p_unit,p_event,clock_timestamp(),props,null);
 return jsonb_build_object('event_id',p_request,'variant',a.variant);
end $$;
create function public.fw_experiment_commerce() returns trigger language plpgsql security invoker set search_path='' as $$
declare a public.fw_experiment_assignments; props jsonb; oid uuid; begin
 if new.event not in ('view_item','add_to_cart','remove_from_cart','begin_checkout','return_to_cart','add_payment_info','purchase','payment_error') then return new; end if;
 select assignment.* into a from public.fw_experiment_sessions link join public.fw_experiment_assignments assignment using(experiment_id,dataset_id,unit_id) where link.session_id=new.session_id;
 if not found then return new; end if;
 if new.event='purchase' then
 select id into strict oid from public.fw_orders where id=(new.properties->>'transaction_id')::uuid and session_id=new.session_id and user_id=new.user_id;
 end if;
 props:=new.properties||jsonb_build_object('dataset_id',a.dataset_id,'experiment_id',a.experiment_id,'variant',a.variant,'experiment_unit_id',a.unit_id,'allocation_unit','visitor','device',a.device,'$device_type',a.device,'acquisition_channel',a.channel,'data_source','experiment_backend');
 insert into public.fw_experiment_events values(new.id,a.experiment_id,a.dataset_id,a.unit_id,new.event,new.occurred_at,props,oid);
 return new;
end $$;
create trigger fw_order_experiment_event after insert on public.fw_events for each row execute function public.fw_experiment_commerce();
create function public.fw_import_experiment(p_events jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e jsonb; p jsonb; unit text; variant text; at timestamptz; inserted integer:=0; n integer; begin
 if jsonb_array_length(p_events)>500 then raise exception 'Import at most 500 events'; end if;
 for e in select value from jsonb_array_elements(p_events) loop
  p:=e->'properties'; unit:=e->>'distinct_id';variant:=p->>'variant';at:=(e->>'timestamp')::timestamptz;
  if p->>'dataset_id' is distinct from 'fieldwork_experiment_2000_v1' or p->>'experiment_id' is distinct from 'fw_quick_add_v1' or unit !~ '^fw-experiment-v1-[0-9]{4}$' or p->>'experiment_unit_id' is distinct from unit or variant is distinct from public.fw_experiment_variant(unit) or p->>'is_synthetic' is distinct from 'true' or p->>'data_source' is distinct from 'experiment_synthetic_seed' or at<'2026-11-09'::timestamptz or at>='2026-11-23'::timestamptz then raise exception 'Invalid synthetic experiment record'; end if;
  if e->>'event' not in ('$pageview','experiment_exposure','view_item','product_cta_clicked','demo_signed_in','add_to_cart','begin_checkout','add_payment_info','payment_error','purchase') then raise exception 'Invalid imported event'; end if;
  insert into public.fw_experiment_assignments values('fw_quick_add_v1','fieldwork_experiment_2000_v1',unit,variant,p->>'device',p->>'acquisition_channel',at,null) on conflict do nothing;
  if exists(select 1 from public.fw_experiment_events where id=(e->>'uuid')::uuid and (experiment_id<>'fw_quick_add_v1' or dataset_id<>'fieldwork_experiment_2000_v1' or unit_id<>unit or event<>e->>'event' or occurred_at<>at or properties<>p)) then raise exception 'Import UUID conflicts with an existing record'; end if;
  insert into public.fw_experiment_events values((e->>'uuid')::uuid,'fw_quick_add_v1','fieldwork_experiment_2000_v1',unit,e->>'event',at,p,null) on conflict(id) do nothing;
  get diagnostics n=row_count;inserted:=inserted+n;
 end loop;
 return jsonb_build_object('inserted',inserted,'received',jsonb_array_length(p_events));
end $$;
create function public.fw_experiment_analytics(p_dataset text,p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare output jsonb; begin
 if p_dataset not in ('fieldwork_experiment_2000_v1','fieldwork_experiment_live_v1') or p_end<=p_start or p_end-p_start>interval '93 days' then raise exception 'Invalid experiment query window'; end if;
 with cohort as (
  select * from public.fw_experiment_assignments where experiment_id='fw_quick_add_v1' and dataset_id=p_dataset and first_exposure_at>=p_start and first_exposure_at<p_end
 ), per_unit as (
  select a.unit_id,a.variant,a.device,a.channel,
   bool_or(e.event='view_item')::int engaged,bool_or(e.event='product_cta_clicked')::int cta_clicks,
   bool_or(e.event='add_to_cart')::int carts,bool_or(e.event='begin_checkout')::int checkouts,
   bool_or(e.event='purchase')::int purchases,bool_or(e.event='payment_error')::int payment_errors,
   coalesce(sum((e.properties->>'value')::numeric) filter(where e.event='purchase'),0) revenue
  from cohort a left join public.fw_experiment_events e on e.experiment_id=a.experiment_id and e.dataset_id=a.dataset_id and e.unit_id=a.unit_id and e.occurred_at>=a.first_exposure_at and e.occurred_at<p_end
  group by a.unit_id,a.variant,a.device,a.channel
 ), groups as (
  select case when grouping(device)=0 then 'device' when grouping(channel)=0 then 'channel' else 'all' end dimension,
   coalesce(device,channel,'all') segment,variant,count(*) visitors,
   coalesce(sum(engaged),0) engaged,coalesce(sum(cta_clicks),0) cta_clicks,coalesce(sum(carts),0) carts,coalesce(sum(checkouts),0) checkouts,
   coalesce(sum(purchases),0) purchases,coalesce(sum(payment_errors),0) payment_errors,coalesce(sum(revenue),0) revenue,
   count(*)-coalesce(sum(engaged),0) bounce
  from per_unit group by grouping sets ((variant),(variant,device),(variant,channel))
 ) select jsonb_build_object('groups',coalesce((select jsonb_agg(to_jsonb(g)) from groups g),'[]'),
  'events',(select count(*) from public.fw_experiment_events where dataset_id=p_dataset and occurred_at>=p_start and occurred_at<p_end),
  'assigned',(select count(*) from public.fw_experiment_assignments where dataset_id=p_dataset and assigned_at>=p_start and assigned_at<p_end),
  'pending_events',(select count(*) from public.fw_experiment_outbox ob join public.fw_experiment_events e on e.id=ob.event_id where e.dataset_id=p_dataset and e.occurred_at>=p_start and e.occurred_at<p_end and ob.state<>'sent')) into output;
 return output;
end $$;
create function public.fw_claim_experiment_events(p_limit integer default 100) returns table(id uuid,user_id text,event text,occurred_at timestamptz,properties jsonb) language sql security invoker set search_path='' as $$
 with candidates as (select event_id from public.fw_experiment_outbox where state='pending' or (state='processing' and updated_at<now()-interval '2 minutes') order by updated_at limit least(p_limit,500) for update skip locked),
 claimed as (update public.fw_experiment_outbox set state='processing',attempts=attempts+1,updated_at=now() where event_id in(select event_id from candidates) returning event_id)
 select e.id,e.unit_id,e.event,e.occurred_at,e.properties from public.fw_experiment_events e join claimed c on c.event_id=e.id;
$$;
create function public.fw_ack_experiment_events(p_ids uuid[],p_sent boolean,p_error text default null) returns void language sql security invoker set search_path='' as $$
 update public.fw_experiment_outbox set state=case when p_sent then 'sent' else 'pending' end,updated_at=now(),last_error=p_error where event_id=any(p_ids);
$$;
do $$ declare t text; f record; begin
 foreach t in array array['fw_experiment_assignments','fw_experiment_sessions','fw_experiment_events','fw_experiment_outbox'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'fw_experiment_%' or proname in ('fw_import_experiment','fw_claim_experiment_events','fw_ack_experiment_events')) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
