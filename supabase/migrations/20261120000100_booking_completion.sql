alter table public.bookings
  add column completion_due_at timestamptz,
  add column completion_hold_at timestamptz,
  add column completion_remaining_ms integer,
  add constraint bookings_completion_state_check check (
    (status = 'delivered' or (completion_due_at is null and completion_hold_at is null))
    and (
      (completion_hold_at is null and completion_remaining_ms is null)
      or (
        completion_hold_at is not null and completion_due_at is null
        and completion_remaining_ms is not null
        and completion_remaining_ms between 0 and 604800000
      )
    )
  );

create index bookings_completion_due_idx on public.bookings (completion_due_at, id)
  where status = 'delivered' and completion_hold_at is null and completion_due_at is not null;

create table private.booking_completion_events (
  id uuid primary key default public.uuid_generate_v7(),
  booking_id uuid not null references public.bookings(id),
  event text not null check (event in ('started', 'held', 'resumed', 'client_completed', 'auto_completed')),
  actor_id uuid references public.profiles(id),
  occurred_at timestamptz not null,
  due_at timestamptz,
  remaining_ms integer,
  reason text not null default ''
);
create index booking_completion_events_booking_idx
  on private.booking_completion_events (booking_id, occurred_at, id);
alter table private.booking_completion_events enable row level security;
revoke all on table private.booking_completion_events from public, anon, authenticated;

-- Existing deliveries are left unscheduled. They may predate this policy.
create function private.track_booking_completion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  event_at timestamptz := pg_catalog.clock_timestamp();
  actor uuid := auth.uid();
begin
  if new.status = 'delivered' then
    new.completion_due_at := event_at + interval '168 hours';
    insert into private.booking_completion_events (booking_id, event, actor_id, occurred_at, due_at)
    values (new.id, 'started', actor, event_at, new.completion_due_at);
  elsif old.status = 'delivered' then
    new.completion_due_at := null;
    new.completion_hold_at := null;
    new.completion_remaining_ms := null;
    if new.status = 'completed' then
      insert into private.booking_completion_events (booking_id, event, actor_id, occurred_at)
      values (new.id, case when actor is null then 'auto_completed' else 'client_completed' end,
              actor, event_at);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.track_booking_completion() from public, anon, authenticated;
create trigger track_booking_completion before update of status on public.bookings
  for each row when (old.status is distinct from new.status)
  execute function private.track_booking_completion();

create function public.frameroom_set_completion_hold(
  p_booking_id uuid, p_hold boolean, p_version integer, p_reason text
) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  event_at timestamptz;
  remaining_ms integer;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_hold is null or p_version is null or coalesce(length(btrim(p_reason)), 0) not between 1 and 1000 then
    raise exception 'invalid_hold_request' using errcode = '22023';
  end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if b.status <> 'delivered' or (b.completion_due_at is null and b.completion_hold_at is null) then
    raise exception 'completion_hold_unavailable' using errcode = '23514';
  end if;
  if p_hold = (b.completion_hold_at is not null) then
    return b;
  end if;
  if p_version <> b.version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  event_at := pg_catalog.clock_timestamp();
  if p_hold then
    if b.completion_due_at <= event_at then
      raise exception 'completion_hold_unavailable' using errcode = '23514';
    end if;
    remaining_ms := least(604800000, ceil(extract(epoch from (b.completion_due_at - event_at)) * 1000));
    update public.bookings
      set completion_due_at = null, completion_hold_at = event_at,
          completion_remaining_ms = remaining_ms, version = version + 1
      where id = b.id returning * into b;
  else
    remaining_ms := b.completion_remaining_ms;
    update public.bookings
      set completion_due_at = event_at + remaining_ms * interval '1 millisecond',
          completion_hold_at = null, completion_remaining_ms = null, version = version + 1
      where id = b.id returning * into b;
  end if;
  insert into private.booking_completion_events
    (booking_id, event, actor_id, occurred_at, due_at, remaining_ms, reason)
  values (b.id, case when p_hold then 'held' else 'resumed' end,
          auth.uid(), event_at, b.completion_due_at, remaining_ms, btrim(p_reason));
  return b;
end;
$$;
revoke all on function public.frameroom_set_completion_hold(uuid, boolean, integer, text)
  from public, anon, authenticated;
grant execute on function public.frameroom_set_completion_hold(uuid, boolean, integer, text)
  to service_role;

create function public.frameroom_complete_due_bookings() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  booking_id_to_complete uuid;
  completed_count integer := 0;
begin
  if auth.uid() is not null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for booking_id_to_complete in
    select id from public.bookings
    where status = 'delivered' and completion_hold_at is null
      and completion_due_at <= statement_timestamp()
    order by completion_due_at, id
    limit 100 for update skip locked
  loop
    update public.bookings set status = 'completed', version = version + 1
      where id = booking_id_to_complete;
    update public.shoot_rooms set status = 'closed'
      where booking_id = booking_id_to_complete;
    insert into public.room_messages (room_id, sender_id, text, type)
      select id, null, 'completed', 'system' from public.shoot_rooms
      where booking_id = booking_id_to_complete;
    completed_count := completed_count + 1;
  end loop;
  return completed_count;
end;
$$;
revoke all on function public.frameroom_complete_due_bookings() from public, anon, authenticated;
grant execute on function public.frameroom_complete_due_bookings() to service_role;
