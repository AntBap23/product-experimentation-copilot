create or replace function public.fw_store_action_with_context(p_user text,p_session uuid,p_action text,p_data jsonb,p_request uuid,p_at timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; context jsonb; entry jsonb; event_id uuid; props jsonb;
begin
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into context from jsonb_each(coalesce(p_data->'_web','{}'::jsonb)) where key=any(array['page_name','page_type','page_path','page_url','site_section','referrer_domain','utm_source','utm_medium','utm_campaign','browser','os','screen_width','screen_height','language','visitor_id','context_origin']);
 result:=public.fw_store_action(p_user,p_session,p_action,p_data-'_web',p_request,p_at);
 event_id:=(result->>'event_id')::uuid;
 select web_context into entry from public.fw_sessions where id=p_session and user_id=p_user;
 if entry='{}'::jsonb and context<>'{}'::jsonb then update public.fw_sessions set web_context=context where id=p_session;entry:=context;end if;
 context:=context||jsonb_build_object('schema_version','fieldwork_web_v1','entry_page_name',entry->>'page_name','entry_referrer_domain',entry->>'referrer_domain','entry_utm_source',entry->>'utm_source','entry_utm_campaign',entry->>'utm_campaign');
 update public.fw_events set properties=properties||context where id=event_id and not(properties ? 'schema_version') returning properties into props;
 if props is null then select properties into props from public.fw_events where id=event_id;end if;
 if props ? 'items' then
  props:=jsonb_set(props,'{items}',(select jsonb_agg(x||jsonb_build_object('item_name',p.name,'category',p.category,'currency','USD','line_revenue_cents',(x->>'quantity')::bigint*(x->>'unit_price_cents')::bigint)) from jsonb_array_elements(props->'items') x join public.fw_products p on p.id=x->>'item_id'));
 elsif props ? 'item_id' then
  props:=props||(select jsonb_build_object('item_name',name,'item_category',category) from public.fw_products where id=props->>'item_id');
 end if;
 update public.fw_events set properties=props where id=event_id;
 result:=jsonb_set(result,'{properties}',props);
 update public.fw_action_receipts set response=result where session_id=p_session and request_id=p_request;
 return result;
end $$;
