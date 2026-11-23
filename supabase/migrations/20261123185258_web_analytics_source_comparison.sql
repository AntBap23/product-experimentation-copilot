create function public.fw_web_analytics(p_dataset text,p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_dataset not in ('fieldwork_live_v2','fieldwork_flow_v1') or p_end<=p_start or p_end-p_start>interval '93 days' then raise exception 'Invalid web analytics scope';end if;
 with events as (select * from public.fw_events where dataset_id=p_dataset and occurred_at>=p_start and occurred_at<p_end),
 groups as (select 'event' as dimension,event as value,count(*) as events,count(distinct user_id) as users,count(distinct session_id) as sessions from events group by event
 union all select 'device',properties->>'device',count(*),count(distinct user_id),count(distinct session_id) from events group by properties->>'device'
 union all select 'channel',properties->>'acquisition_channel',count(*),count(distinct user_id),count(distinct session_id) from events group by properties->>'acquisition_channel'
 union all select 'page',coalesce(properties->>'page_name','Unspecified'),count(*),count(distinct user_id),count(distinct session_id) from events where event='$pageview' group by coalesce(properties->>'page_name','Unspecified'))
 select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(g) order by dimension,value),'[]'::jsonb),'scope','Canonical signed-in application events. Guest/browser-only traffic is separate. Page metrics count explicit pageview events, not modal opens or native PostHog visits.') into result from groups g;
 return result;
end $$;
revoke all on function public.fw_web_analytics(text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.fw_web_analytics(text,timestamptz,timestamptz) to service_role;
