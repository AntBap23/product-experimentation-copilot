create function public.fw_browser_login(p_device text,p_channel text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare id text:='fieldwork-browser-'||gen_random_uuid()::text; label text; sid uuid:=gen_random_uuid();begin
 if p_device not in ('Mobile','Desktop') or p_channel not in ('organic','email','paid_search','social') then raise exception 'Invalid visitor context';end if;
 label:='Visitor '||left(replace(id,'fieldwork-browser-',''),8);
 insert into public.fw_users(id,dataset_id,name,is_synthetic) values(id,'fieldwork_live_v2',label,true);
 return public.fw_login(id,sid,p_device,p_channel,'fieldwork_live_v2',label,now());
end $$;
revoke all on function public.fw_browser_login(text,text) from public,anon,authenticated;grant execute on function public.fw_browser_login(text,text) to service_role;
