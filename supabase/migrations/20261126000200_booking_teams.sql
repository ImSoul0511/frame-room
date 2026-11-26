create table public.booking_team (
  booking_id uuid not null references public.bookings(id),
  photographer_id uuid not null references public.photographers(id),
  primary key (booking_id, photographer_id)
);
create table public.booking_attendance (
  booking_id uuid not null references public.bookings(id),
  photographer_id uuid not null references public.photographers(id),
  primary key (booking_id, photographer_id)
);
alter table public.booking_team enable row level security;
alter table public.booking_attendance enable row level security;
create policy booking_team_read on public.booking_team for select to authenticated
  using (private.can_read_booking(booking_id));
revoke all on public.booking_team, public.booking_attendance from public, anon, authenticated;
grant select on public.booking_team to authenticated;
grant all on public.booking_team, public.booking_attendance to service_role;

insert into public.booking_team(booking_id,photographer_id)
  select id,assigned_photographer_id from public.bookings
  where studio_id is not null and assigned_photographer_id is not null;

create or replace function private.provider_side(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b where b.id = bid and (
      private.owns_provider(b.photographer_id,b.studio_id)
      or (b.status in ('confirmed','in_progress','proofing','delivered','completed') and exists (
        select 1 from public.studio_members m join public.photographers p on p.user_id=m.user_id
        join public.studios s on s.id=m.studio_id and s.deleted_at is null
        join public.booking_team t on t.booking_id=b.id and t.photographer_id=p.id
        where m.studio_id=b.studio_id and p.user_id=auth.uid()
      ))
    )
  );
$$;

create function public.review_credits(pid uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select r.id from public.reviews r
  where not r.is_hidden and r.deleted_at is null and (
    r.photographer_id = pid or exists (
      select 1 from public.booking_attendance a where a.booking_id=r.booking_id and a.photographer_id=pid
    )
  );
$$;
revoke all on function public.review_credits(uuid) from public;
grant execute on function public.review_credits(uuid) to anon,authenticated,service_role;

-- Serialize assignment validation against membership departure using the studio row.
create or replace function private.reserve_booking(bid uuid, starts timestamptz, ends timestamptz, assignee uuid, resources uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare b public.bookings; rid uuid; crew uuid[]; begin
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
 select array_agg(person order by person) into crew from (
  select assignee as person
  union select photographer_id from public.booking_team where booking_id=bid and b.studio_id is not null
 ) team;
 if b.studio_id is not null and exists (
  select 1 from unnest(crew) person where not exists (
   select 1 from public.studio_members m join public.photographers p on p.user_id=m.user_id
   where m.studio_id=b.studio_id and p.id=person and not p.is_hidden
  )
 ) then raise exception 'invalid_assignment' using errcode='23514'; end if;
 delete from public.schedule_entries where booking_id=bid;
 insert into public.schedule_entries(booking_id,photographer_id,during,label) select bid,person,tstzrange(starts,ends,'[)'),b.service_name from unnest(crew) person;
 delete from public.booking_resources where booking_id=bid;
 foreach rid in array resources loop
  insert into public.schedule_entries(booking_id,resource_id,during,label) values(bid,rid,tstzrange(starts,ends,'[)'),b.service_name);
  insert into public.booking_resources select bid,id,name,type from public.studio_resources where id=rid;
 end loop;
 update public.bookings set scheduled_start=starts,scheduled_end=ends,assigned_photographer_id=assignee where id=bid;
end $$;
revoke all on function private.reserve_booking(uuid,timestamptz,timestamptz,uuid,uuid[]) from public,anon,authenticated;

-- Expose enum arrays as native JSON arrays through the PostgreSQL driver.

create or replace view public.providers with (security_invoker=true) as
select p.id,'photographer'::text as type,p.display_name,p.bio,p.city,p.district,p.genres::text[] as genres,p.styles,
 (select min(price) from public.services s where s.photographer_id=p.id and is_active and deleted_at is null) as price_from,
 (select round(avg(rating),1)::float from public.reviews r where r.id in (select public.review_credits(p.id))) as rating_avg,
 (select count(*)::int from public.reviews r where r.id in (select public.review_credits(p.id))) as review_count
from public.photographers p where not p.is_hidden
union all
select s.id,'studio'::text,s.name,s.description,s.city,s.district,s.genres::text[],'{}'::text[],
 (select min(price) from public.services v where v.studio_id=s.id and is_active and deleted_at is null),
 (select round(avg(rating),1)::float from public.reviews r where r.studio_id=s.id and not is_hidden and deleted_at is null),
 (select count(*)::int from public.reviews r where r.studio_id=s.id and not is_hidden and deleted_at is null)
from public.studios s where not s.is_hidden and s.deleted_at is null;
grant select on public.providers to anon,authenticated,service_role;

create or replace function private.notify_booking_parties(bid uuid, kind text, actor uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications(recipient_id, booking_id, event)
  select distinct recipient, bid, kind from public.bookings b
  cross join lateral (
    select b.client_id as recipient
    union select p.user_id from public.photographers p where p.id = b.photographer_id
    union select m.user_id from public.studio_members m
      where m.studio_id=b.studio_id and m.role='manager'
    union select p.user_id from public.booking_team t join public.photographers p on p.id=t.photographer_id
      join public.studio_members m on m.user_id=p.user_id and m.studio_id=b.studio_id
      where t.booking_id=b.id and b.status<>'pending'
  ) recipients
  where b.id=bid and recipient is distinct from actor;
$$;
