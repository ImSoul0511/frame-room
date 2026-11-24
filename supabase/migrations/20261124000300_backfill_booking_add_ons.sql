-- Restore historical line items only when the stored snapshot is unambiguous.
do $$
declare
  booking_row record;
  item jsonb;
  addon_id uuid;
  addon_price integer;
begin
  for booking_row in
    select id, service_snapshot from public.bookings
    where service_snapshot ? 'addOns'
  loop
    if jsonb_typeof(booking_row.service_snapshot->'addOns') <> 'array' then
      raise exception 'Invalid add-on snapshot for booking %', booking_row.id;
    end if;
    if exists (
      select 1 from jsonb_array_elements(booking_row.service_snapshot->'addOns') entry
      group by lower(entry->>'id') having count(*) > 1
    ) then
      raise exception 'Duplicate add-on in snapshot for booking %', booking_row.id;
    end if;

    for item in select value from jsonb_array_elements(booking_row.service_snapshot->'addOns')
    loop
      if jsonb_typeof(item) <> 'object'
        or jsonb_typeof(item->'id') is distinct from 'string'
        or jsonb_typeof(item->'name') is distinct from 'string'
        or jsonb_typeof(item->'price') is distinct from 'number'
        or (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or (item->>'price') !~ '^(0|[1-9][0-9]*)$'
        or (item->>'price')::numeric > 2147483647 then
        raise exception 'Invalid add-on item for booking %', booking_row.id;
      end if;
      addon_id := (item->>'id')::uuid;
      addon_price := (item->>'price')::integer;
      if not exists (select 1 from public.service_add_ons where id=addon_id) then
        raise exception 'Missing add-on % for booking %', addon_id, booking_row.id;
      end if;
      if exists (
        select 1 from public.booking_add_ons
        where booking_id=booking_row.id and add_on_id=addon_id
          and (name is distinct from item->>'name' or quantity <> 1 or unit_price <> addon_price)
      ) then
        raise exception 'Conflicting add-on % for booking %', addon_id, booking_row.id;
      end if;
      insert into public.booking_add_ons(booking_id,add_on_id,name,quantity,unit_price)
      values (booking_row.id,addon_id,item->>'name',1,addon_price)
      on conflict (booking_id,add_on_id) do nothing;
    end loop;
  end loop;
end;
$$;
