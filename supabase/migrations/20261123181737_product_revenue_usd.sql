create function public.fw_valid_usd_items(items jsonb,total bigint) returns boolean language sql immutable set search_path='' as $$
 select case when jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 then false else
 coalesce((select bool_and(x->>'item_id' is not null and (x->>'quantity')::numeric>0 and (x->>'quantity')::numeric=trunc((x->>'quantity')::numeric) and (x->>'unit_price_cents')::numeric>=0 and (x->>'unit_price_cents')::numeric=trunc((x->>'unit_price_cents')::numeric)) and sum((x->>'quantity')::bigint*(x->>'unit_price_cents')::bigint)=total from jsonb_array_elements(items) x),false) end;
$$;
create table public.fw_imported_purchases(
 dataset_id text not null check(dataset_id='fieldwork_synthetic_2000_v1'), transaction_id text not null,
 source_event_id uuid not null, occurred_at timestamptz not null, currency text not null check(currency='USD'),
 total_cents bigint not null check(total_cents>=0), items jsonb not null,
 provenance text not null default 'Confirmed PostHog synthetic purchase import' check(provenance='Confirmed PostHog synthetic purchase import'),
 primary key(dataset_id,transaction_id), unique(dataset_id,source_event_id), check(public.fw_valid_usd_items(items,total_cents))
);
create index fw_imported_purchase_window on public.fw_imported_purchases(dataset_id,occurred_at);
alter table public.fw_imported_purchases enable row level security;
revoke all on public.fw_imported_purchases from public,anon,authenticated;
grant select,insert,update on public.fw_imported_purchases to service_role;
create function public.fw_product_revenue(p_dataset text,p_start timestamptz,p_end timestamptz) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_dataset not in ('fieldwork_live_v2','fieldwork_flow_v1','fieldwork_synthetic_2000_v1') or p_end<=p_start or p_end-p_start>interval '93 days' then raise exception 'Invalid revenue scope'; end if;
 if exists(select 1 from public.fw_orders where dataset_id=p_dataset and created_at>=p_start and created_at<p_end and currency<>'USD') then raise exception 'Non-USD order cannot be combined with USD revenue'; end if;
 with lines as (
 select o.id::text as transaction_id,i.product_id as id,p.name,i.quantity::bigint as quantity,i.unit_price_cents::bigint as unit_price_cents
 from public.fw_orders o join public.fw_order_items i on i.order_id=o.id join public.fw_products p on p.id=i.product_id
 where o.dataset_id=p_dataset and o.created_at>=p_start and o.created_at<p_end
 union all
 select o.transaction_id,x->>'item_id',coalesce(x->>'name',x->>'item_id'),(x->>'quantity')::bigint,(x->>'unit_price_cents')::bigint
 from public.fw_imported_purchases o cross join lateral jsonb_array_elements(o.items) x
 where o.dataset_id=p_dataset and o.occurred_at>=p_start and o.occurred_at<p_end
 ), products as (select id,max(name) as name,sum(quantity) as units,count(distinct transaction_id) as orders,sum(quantity*unit_price_cents) as revenue_cents from lines group by id)
 select jsonb_build_object('currency','USD','revenue_definition','Gross merchandise revenue: sum(quantity × purchase-time unit price); simulated payments; no refunds, tax or shipping.',
 'provenance',case when p_dataset='fieldwork_synthetic_2000_v1' then 'Imported synthetic purchase events, not storefront orders' else 'Persisted storefront order line items' end,
 'products',coalesce((select jsonb_agg(to_jsonb(p) order by revenue_cents desc,id) from products p),'[]'::jsonb),
 'total_revenue_cents',coalesce((select sum(revenue_cents) from products),0),'purchase_count',(select count(distinct transaction_id) from lines)) into result;
 return result;
end $$;
revoke all on function public.fw_product_revenue(text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.fw_product_revenue(text,timestamptz,timestamptz) to service_role;
revoke all on function public.fw_valid_usd_items(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.fw_valid_usd_items(jsonb,bigint) to service_role;
