alter table public.fw_products add column description text not null default '',add column category text not null default 'Trail essentials';
update public.fw_products set description=case id when 'ridge-22' then 'A lightweight 22 L pack with easy-access side pockets.' when 'summit-750' then 'A 750 mL insulated bottle for full days outside.' else description end;
insert into public.fw_products(id,name,price_cents,description,category) values
('alpine-fleece','Alpine Fleece',9600,'Warm recycled fleece for crisp starts and cool evenings.','Layers'),
('storm-shell','Storm Shell',14800,'A packable waterproof layer for unpredictable trail weather.','Layers'),
('trail-pants','Trail Pants',9200,'Stretch woven trousers with room to move and secure pockets.','Apparel'),
('merino-socks','Merino Trail Socks',1800,'Cushioned merino socks that keep feet comfortable all day.','Apparel'),
('camp-mug','Camp Mug',2400,'An insulated stainless-steel mug for coffee at camp.','Camp'),
('packable-cap','Packable Cap',2600,'A lightweight quick-drying cap that folds into a pocket.','Apparel'),
('ridge-poles','Ridge Trekking Poles',8800,'Adjustable aluminium poles for steady climbs and descents.','Trail gear'),
('summit-headlamp','Summit Headlamp',4200,'A rechargeable headlamp with a wide beam for early starts.','Trail gear'),
('dry-bag-10','Dry Bag 10 L',3200,'A roll-top waterproof bag for the essentials you need to keep dry.','Packs'),
('camp-seat','Folding Camp Seat',3800,'A compact folding seat for summit breaks and fireside evenings.','Camp');
create function public.fw_catalog() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price_cents/100.0,'price_cents',price_cents,'currency','USD','description',description,'category',category) order by case when id='ridge-22' then 0 when id='summit-750' then 1 else 2 end,name),'[]'::jsonb) from public.fw_products where active;
$$;
revoke all on function public.fw_catalog() from public,anon,authenticated;grant execute on function public.fw_catalog() to service_role;
