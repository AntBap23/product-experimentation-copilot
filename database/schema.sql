begin;
create table public.fw_users (
 id text primary key, dataset_id text not null, name text not null,
 is_synthetic boolean not null default true check(is_synthetic), created_at timestamptz not null default now()
);
create table public.fw_products (
 id text primary key, name text not null, price_cents integer not null check(price_cents>0), active boolean not null default true
);
insert into public.fw_products(id,name,price_cents) values ('ridge-22','Ridge Daypack',8400),('summit-750','Summit Bottle',2800);
create table public.fw_sessions (
 id uuid primary key, user_id text not null references public.fw_users(id), dataset_id text not null,
 device text not null check(device in ('Mobile','Desktop')), channel text not null,
 started_at timestamptz not null default now(), ended_at timestamptz
);
create index on public.fw_sessions(user_id,started_at);
create index on public.fw_sessions(dataset_id,started_at);
create table public.fw_carts (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.fw_sessions(id),
 user_id text not null references public.fw_users(id), status text not null default 'open' check(status in ('open','checkout','complete')),
 created_at timestamptz not null default now()
);
create index on public.fw_carts(user_id);
create index on public.fw_carts(session_id);
create unique index fw_one_active_cart on public.fw_carts(session_id) where status <> 'complete';
create table public.fw_cart_items (
 cart_id uuid not null references public.fw_carts(id), product_id text not null references public.fw_products(id),
 quantity integer not null check(quantity between 1 and 20), primary key(cart_id,product_id)
);
create index on public.fw_cart_items(product_id);
create table public.fw_checkouts (
 id uuid primary key default gen_random_uuid(), cart_id uuid not null unique references public.fw_carts(id),
 status text not null default 'started' check(status in ('started','payment','purchased')),
 total_cents integer not null check(total_cents>0), items jsonb not null, created_at timestamptz not null, payment_at timestamptz
);
create table public.fw_orders (
 id uuid primary key default gen_random_uuid(), checkout_id uuid not null unique references public.fw_checkouts(id),
 user_id text not null references public.fw_users(id), session_id uuid not null references public.fw_sessions(id),
 dataset_id text not null, total_cents integer not null check(total_cents>0), currency text not null default 'USD',
 payment_status text not null default 'simulated' check(payment_status='simulated'), created_at timestamptz not null
);
create index on public.fw_orders(dataset_id,created_at);
create index on public.fw_orders(user_id,created_at);
create index on public.fw_orders(session_id);
create table public.fw_order_items (
 order_id uuid not null references public.fw_orders(id), product_id text not null references public.fw_products(id),
 quantity integer not null check(quantity between 1 and 20), unit_price_cents integer not null check(unit_price_cents>0),
 primary key(order_id,product_id)
);
create index on public.fw_order_items(product_id);
create table public.fw_events (
 id uuid primary key default gen_random_uuid(), user_id text not null references public.fw_users(id),
 session_id uuid not null references public.fw_sessions(id), dataset_id text not null,
 event text not null, occurred_at timestamptz not null, properties jsonb not null default '{}'
);
create index on public.fw_events(dataset_id,occurred_at,event);
create index on public.fw_events(session_id,occurred_at);
create index on public.fw_events(user_id);
create table public.fw_event_outbox (
 event_id uuid primary key references public.fw_events(id), state text not null default 'pending' check(state in ('pending','processing','sent')),
 attempts integer not null default 0, updated_at timestamptz not null default now(), last_error text
);
create index on public.fw_event_outbox(state,updated_at);
create table public.fw_action_receipts (
 session_id uuid not null references public.fw_sessions(id), request_id uuid not null, request_hash text not null,
 response jsonb not null, primary key(session_id,request_id)
);
-- Browser roles cannot read/write these demo records directly. The server owns mutations.
do $$ declare t text; begin
 foreach t in array array['fw_users','fw_products','fw_sessions','fw_carts','fw_cart_items','fw_checkouts','fw_orders','fw_order_items','fw_events','fw_event_outbox','fw_action_receipts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
insert into public.fw_users(id,dataset_id,name) select 'fieldwork-demo-'||lower(n),'fieldwork_live_v2',n||' (Demo)' from unnest(array['Alex','Jordan','Morgan','Riley','Sam','Taylor']) n;

create function public.fw_login(p_user text,p_session uuid,p_device text,p_channel text,p_dataset text,p_name text,p_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare u public.fw_users; begin
 if p_dataset not in ('fieldwork_live_v2','fieldwork_flow_v1') then raise exception 'Unsupported dataset'; end if;
 if p_dataset='fieldwork_flow_v1' then
  if p_user !~ '^fieldwork-flow-v1-[0-9]{4}$' then raise exception 'Invalid fictional user'; end if;
  insert into public.fw_users(id,dataset_id,name,created_at) values(p_user,p_dataset,p_name,p_at) on conflict(id) do nothing;
 end if;
 select * into strict u from public.fw_users where id=p_user and dataset_id=p_dataset;
 insert into public.fw_sessions(id,user_id,dataset_id,device,channel,started_at) values(p_session,u.id,u.dataset_id,p_device,p_channel,p_at) on conflict(id) do nothing;
 if not exists(select 1 from public.fw_sessions where id=p_session and user_id=u.id and dataset_id=u.dataset_id) then raise exception 'Session identity conflict'; end if;
 return jsonb_build_object('user',u.id,'name',u.name,'session_id',p_session,'dataset_id',u.dataset_id);
end $$;

create function public.fw_store_action(p_user text,p_session uuid,p_action text,p_data jsonb,p_request uuid,p_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.fw_sessions; c public.fw_carts; ch public.fw_checkouts; o public.fw_orders;
 prod public.fw_products; r public.fw_action_receipts; e uuid; props jsonb := '{}'; items jsonb; total integer; result jsonb; qty integer; item jsonb;
 h text := md5(p_action||p_data::text); begin
 select * into strict s from public.fw_sessions where id=p_session and user_id=p_user for update;
 select * into r from public.fw_action_receipts where session_id=p_session and request_id=p_request;
 if found then
  if r.request_hash<>h then raise exception 'Idempotency key reused for a different action'; end if;
  return r.response;
 end if;
 if s.ended_at is not null then raise exception 'Session ended'; end if;
 if p_at<s.started_at then raise exception 'Event cannot precede session'; end if;
 select * into c from public.fw_carts where session_id=p_session and status<>'complete' for update;
 if p_action in ('add_to_cart','remove_from_cart','begin_checkout') and c.status='checkout' then
  raise exception 'Return to the bag before changing this checkout';
 end if;
 if p_action='add_to_cart' then
  select * into strict prod from public.fw_products where id=p_data->>'item_id' and active;
  qty := coalesce((p_data->>'quantity')::integer,1);
  if qty not between 1 and 20 then raise exception 'Quantity must be 1 to 20'; end if;
  if c.id is null then insert into public.fw_carts(session_id,user_id,created_at) values(s.id,s.user_id,p_at) returning * into c; end if;
  insert into public.fw_cart_items values(c.id,prod.id,qty) on conflict(cart_id,product_id) do update set quantity=public.fw_cart_items.quantity+excluded.quantity;
  props:=jsonb_build_object('item_id',prod.id,'quantity',qty,'price',prod.price_cents/100.0,'currency','USD');
 elsif p_action='remove_from_cart' then
  if c.id is null then raise exception 'No active cart'; end if;
  delete from public.fw_cart_items where cart_id=c.id and product_id=p_data->>'item_id' returning quantity into qty;
  if not found then raise exception 'Item is not in cart'; end if;
  props:=jsonb_build_object('item_id',p_data->>'item_id','quantity',qty);
 elsif p_action='view_item' then
  select * into strict prod from public.fw_products where id=p_data->>'item_id' and active;
  props:=jsonb_build_object('item_id',prod.id,'price',prod.price_cents/100.0,'currency','USD');
 elsif p_action='return_to_cart' then
  if c.id is not null and c.status='checkout' then
   -- Retain the abandoned checkout snapshot and copy its items to a new cart.
   items := (select coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'quantity',quantity)),'[]') from public.fw_cart_items where cart_id=c.id);
   update public.fw_carts set status='complete' where id=c.id;
   insert into public.fw_carts(session_id,user_id,created_at) values(s.id,s.user_id,p_at) returning * into c;
   for item in select * from jsonb_array_elements(items) loop
    insert into public.fw_cart_items values(c.id,item->>'product_id',(item->>'quantity')::integer);
   end loop;
  end if;
 elsif p_action='begin_checkout' then
  if c.id is null then raise exception 'Cart is empty'; end if;
  select jsonb_agg(jsonb_build_object('item_id',i.product_id,'quantity',i.quantity,'unit_price_cents',p.price_cents)),sum(i.quantity*p.price_cents)
  into items,total from public.fw_cart_items i join public.fw_products p on p.id=i.product_id where i.cart_id=c.id and p.active;
  if total is null then raise exception 'Cart is empty'; end if;
  insert into public.fw_checkouts(cart_id,total_cents,items,created_at) values(c.id,total,items,p_at) returning * into ch;
  update public.fw_carts set status='checkout' where id=c.id;
  props:=jsonb_build_object('checkout_id',ch.id,'value',ch.total_cents/100.0,'currency','USD','items',ch.items);
 elsif p_action in ('add_payment_info','purchase','payment_error') then
  -- Checkout identity is explicit; user/session ownership is checked through its cart.
  select x.* into strict ch from public.fw_checkouts x join public.fw_carts cart on cart.id=x.cart_id
   where x.id=(p_data->>'checkout_id')::uuid and cart.session_id=s.id and cart.user_id=s.user_id for update of x;
  if p_action='add_payment_info' then
   if ch.status<>'started' then raise exception 'Payment already selected or checkout closed'; end if;
   update public.fw_checkouts set status='payment',payment_at=p_at where id=ch.id;
  elsif p_action='purchase' then
   if ch.status='purchased' then raise exception 'Order already placed'; end if;
   if ch.status<>'payment' then raise exception 'Select demo payment first'; end if;
   insert into public.fw_orders(checkout_id,user_id,session_id,dataset_id,total_cents,created_at)
    values(ch.id,s.user_id,s.id,s.dataset_id,ch.total_cents,p_at) returning * into o;
   for item in select * from jsonb_array_elements(ch.items) loop
    insert into public.fw_order_items values(o.id,item->>'item_id',(item->>'quantity')::integer,(item->>'unit_price_cents')::integer);
   end loop;
   update public.fw_checkouts set status='purchased' where id=ch.id;
   update public.fw_carts set status='complete' where id=ch.cart_id;
  end if;
  props:=jsonb_build_object('checkout_id',ch.id,'value',ch.total_cents/100.0,'currency','USD','items',ch.items);
  if o.id is not null then props:=props||jsonb_build_object('transaction_id',o.id); end if;
  if p_action='payment_error' then props:=props||jsonb_build_object('error_code','synthetic_payment_validation'); end if;
 elsif p_action='demo_signed_out' then
  update public.fw_sessions set ended_at=p_at where id=s.id;
 elsif p_action not in ('$pageview','demo_signed_in') then raise exception 'Unsupported action';
 end if;
 props:=props||jsonb_build_object('device',s.device,'acquisition_channel',s.channel,'auth_status','signed_in','is_demo',true,'is_synthetic',true,
  'data_source','store_backend','generation_method','application_flow','dataset_id',s.dataset_id,'demo_session_id',s.id,'demo_user_id',s.user_id,'$device_type',s.device);
 insert into public.fw_events(user_id,session_id,dataset_id,event,occurred_at,properties) values(s.user_id,s.id,s.dataset_id,p_action,p_at,props) returning id into e;
 insert into public.fw_event_outbox(event_id) values(e);
 result:=jsonb_build_object('event_id',e,'properties',props,'order_id',o.id,'checkout_id',ch.id);
 insert into public.fw_action_receipts values(s.id,p_request,h,result);
 return result;
end $$;

create function public.fw_cart(p_user text,p_session uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('item_id',p.id,'name',p.name,'price_cents',p.price_cents,'quantity',i.quantity)),'[]')
 from public.fw_carts c join public.fw_cart_items i on i.cart_id=c.id join public.fw_products p on p.id=i.product_id
 where c.user_id=p_user and c.session_id=p_session and c.status<>'complete'
 and exists(select 1 from public.fw_sessions s where s.id=p_session and s.user_id=p_user and s.ended_at is null);
$$;
create function public.fw_claim_events(p_limit integer default 50) returns setof public.fw_events language sql security invoker set search_path='' as $$
 with selected as (select event_id from public.fw_event_outbox where state='pending' or (state='processing' and updated_at<now()-interval '2 minutes')
 order by updated_at for update skip locked limit least(greatest(p_limit,1),500)), claimed as (
 update public.fw_event_outbox o set state='processing',attempts=attempts+1,updated_at=now() from selected where o.event_id=selected.event_id returning o.event_id)
 select e.* from public.fw_events e join claimed on e.id=claimed.event_id;
$$;
create function public.fw_ack_events(p_ids uuid[],p_sent boolean,p_error text default null) returns void language sql security invoker set search_path='' as $$
 update public.fw_event_outbox set state=case when p_sent then 'sent' else 'pending' end,updated_at=now(),last_error=left(p_error,200) where event_id=any(p_ids);
$$;

create function public.fw_analytics(p_tool text,p_dataset text,p_start timestamptz,p_end timestamptz) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare output jsonb; begin
 if p_end<=p_start or p_end-p_start>interval '93 days' then raise exception 'Invalid analysis window'; end if;
 if p_tool='overview' then
  select jsonb_build_object('users',(select count(distinct user_id) from public.fw_sessions where dataset_id=p_dataset and started_at>=p_start and started_at<p_end),
  'sessions',(select count(*) from public.fw_sessions where dataset_id=p_dataset and started_at>=p_start and started_at<p_end),
  'orders',count(*),'revenue_cents',coalesce(sum(total_cents),0),'as_of',now(),
  'pending_events',(select count(*) from public.fw_event_outbox ob join public.fw_events e on e.id=ob.event_id where e.dataset_id=p_dataset and e.occurred_at>=p_start and e.occurred_at<p_end and ob.state<>'sent')) into output
  from public.fw_orders where dataset_id=p_dataset and created_at>=p_start and created_at<p_end;
 elsif p_tool='funnel' then
  select coalesce(jsonb_agg(t),'[]') into output from (
   select s.device,count(distinct s.id) as sessions,
   count(distinct s.id) filter(where e.event='add_to_cart') as carts,
   count(distinct s.id) filter(where e.event='begin_checkout') as checkouts,
   count(distinct s.id) filter(where e.event='add_payment_info') as payments,
   count(distinct s.id) filter(where e.event='purchase') as purchases
   from public.fw_sessions s left join public.fw_events e on e.session_id=s.id and e.occurred_at>=p_start and e.occurred_at<p_end
   where s.dataset_id=p_dataset and s.started_at>=p_start and s.started_at<p_end group by s.device order by s.device) t;
 elsif p_tool='daily' then
  select coalesce(jsonb_agg(t),'[]') into output from (
  select date_trunc('day',created_at at time zone 'UTC')::date as day,count(*) as orders,sum(total_cents) as revenue_cents
  from public.fw_orders where dataset_id=p_dataset and created_at>=p_start and created_at<p_end group by 1 order by 1) t;
 elsif p_tool='products' then
  select coalesce(jsonb_agg(t),'[]') into output from (
  select p.id,p.name,sum(i.quantity) as units,sum(i.quantity*i.unit_price_cents) as revenue_cents
  from public.fw_order_items i join public.fw_orders o on o.id=i.order_id join public.fw_products p on p.id=i.product_id
  where o.dataset_id=p_dataset and o.created_at>=p_start and o.created_at<p_end group by p.id,p.name order by revenue_cents desc) t;
 elsif p_tool='channels' then
  select coalesce(jsonb_agg(t),'[]') into output from (
  select s.channel,count(distinct s.id) as sessions,count(distinct o.id) as orders,coalesce(sum(o.total_cents),0) as revenue_cents
  from public.fw_sessions s left join public.fw_orders o on o.session_id=s.id and o.created_at>=p_start and o.created_at<p_end
  where s.dataset_id=p_dataset and s.started_at>=p_start and s.started_at<p_end group by s.channel order by orders desc) t;
 elsif p_tool='orders' then
  select coalesce(jsonb_agg(t),'[]') into output from (select id,user_id,total_cents,created_at from public.fw_orders
   where dataset_id=p_dataset and created_at>=p_start and created_at<p_end order by created_at desc limit 500) t;
 else raise exception 'Unsupported analysis tool'; end if;
 return output;
end $$;
-- No public RPC execution. These functions are invoked only by server-owned credentials.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'fw_%' loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
