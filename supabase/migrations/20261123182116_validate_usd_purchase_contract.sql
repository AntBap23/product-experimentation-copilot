create or replace function public.fw_valid_usd_items(items jsonb,total bigint) returns boolean language sql immutable set search_path='' as $$
 select case when jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 then false else
 coalesce((select bool_and(coalesce(nullif(x->>'item_id','') is not null and (x->>'quantity')::numeric>0 and (x->>'quantity')::numeric=trunc((x->>'quantity')::numeric) and (x->>'unit_price_cents')::numeric>=0 and (x->>'unit_price_cents')::numeric=trunc((x->>'unit_price_cents')::numeric),false)) and sum((x->>'quantity')::bigint*(x->>'unit_price_cents')::bigint)=total from jsonb_array_elements(items) x),false) end;
$$;
alter table public.fw_orders add constraint fw_orders_currency_usd check(currency='USD');
