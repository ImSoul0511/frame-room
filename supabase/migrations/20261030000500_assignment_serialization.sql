-- Serialize assignment validation against membership departure using the studio row.
create or replace function private.reserve_booking(bid uuid, starts timestamptz, ends timestamptz, assignee uuid, resources uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare b public.bookings; rid uuid; begin
 select * into strict b from public.bookings where id=bid for update;
 if b.studio_id is not null then
  perform 1 from public.studios where id=b.studio_id and deleted_at is null for update;
  if not found then raise exception 'studio_unavailable' using errcode='23514'; end if;
 end if;
 if starts>=ends or ends-starts>interval '24 hours' then raise exception 'invalid_interval' using errcode='23514'; end if;
 if b.studio_id is null then
  if cardinality(resources)>0 or (assignee is not null and assignee<>b.photographer_id) then raise exception 'invalid_assignment' using errcode='23514'; end if;
  assignee=b.photographer_id;
 elsif assignee is null or not exists(select 1 from public.studio_members m join public.photographers p on p.user_id=m.user_id where m.studio_id=b.studio_id and p.id=assignee) then
  raise exception 'invalid_assignment' using errcode='23514';
 end if;
 if exists(select 1 from unnest(resources) r where not exists(select 1 from public.studio_resources where id=r and studio_id=b.studio_id and is_active and deleted_at is null)) then
  raise exception 'invalid_resource' using errcode='23514'; end if;
 if cardinality(resources)<>(select count(distinct r) from unnest(resources) r) then raise exception 'duplicate_resource' using errcode='23514'; end if;
 delete from public.schedule_entries where booking_id=bid;
 insert into public.schedule_entries(booking_id,photographer_id,during,label) values(bid,assignee,tstzrange(starts,ends,'[)'),b.service_name);
 delete from public.booking_resources where booking_id=bid;
 foreach rid in array resources loop
  insert into public.schedule_entries(booking_id,resource_id,during,label) values(bid,rid,tstzrange(starts,ends,'[)'),b.service_name);
  insert into public.booking_resources select bid,id,name,type from public.studio_resources where id=rid;
 end loop;
 update public.bookings set scheduled_start=starts,scheduled_end=ends,assigned_photographer_id=assignee where id=bid;
end $$;
revoke all on function private.reserve_booking(uuid,timestamptz,timestamptz,uuid,uuid[]) from public,anon,authenticated;
