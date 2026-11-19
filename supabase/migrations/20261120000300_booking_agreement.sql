alter table public.brief_versions add column status text not null default 'open'
  constraint chk_brief_version_status check (status in ('open', 'closed'));
alter table public.bookings add column request_key uuid,
  add constraint uq_booking_request unique(client_id, request_key);

create table private.booking_events (
  id uuid primary key default public.uuid_generate_v7(),
  booking_id uuid not null references public.bookings(id),
  actor_id uuid references public.profiles(id),
  event text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_booking_events_booking on private.booking_events(booking_id, created_at desc, id);
alter table private.booking_events enable row level security;
revoke all on private.booking_events from public, anon, authenticated;

create table public.notifications (
  id uuid primary key default public.uuid_generate_v7(),
  recipient_id uuid not null references public.profiles(id),
  booking_id uuid references public.bookings(id),
  studio_id uuid references public.studios(id),
  event text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_recipient on public.notifications(recipient_id, created_at desc, id);
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_read on public.notifications for select to authenticated
  using (recipient_id = auth.uid());

create function private.notify_booking_parties(bid uuid, kind text, actor uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications(recipient_id, booking_id, event)
  select distinct recipient, bid, kind from public.bookings b
  cross join lateral (
    select b.client_id as recipient
    union select p.user_id from public.photographers p where p.id = b.assigned_photographer_id
    union select m.user_id from public.studio_members m
      where m.studio_id = b.studio_id and m.role = 'manager'
  ) recipients
  where b.id = bid and recipient is distinct from actor;
$$;
revoke all on function private.notify_booking_parties(uuid,text,uuid) from public, anon, authenticated;

create function private.notify_booking_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify_booking_parties(new.id, 'newBooking', auth.uid());
  elsif new.status is distinct from old.status then
    perform private.notify_booking_parties(new.id, 'bookingUpdated', auth.uid());
  end if;
  return new;
end;
$$;
create trigger notify_booking_status after insert or update of status on public.bookings
  for each row execute function private.notify_booking_status();

alter table public.room_milestones
  add column updated_by uuid references public.profiles(id),
  add column updated_at timestamptz;

create or replace function private.provider_side(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b where b.id = bid and (
      private.owns_provider(b.photographer_id, b.studio_id)
      or exists (
        select 1 from public.studio_members m join public.photographers p on p.user_id = m.user_id
        join public.studios s on s.id = m.studio_id and s.deleted_at is null
        where m.studio_id = b.studio_id and p.id = b.assigned_photographer_id and p.user_id = auth.uid()
      )
    )
  );
$$;

create table public.booking_cancellations (
  id uuid primary key default public.uuid_generate_v7(),
  booking_id uuid not null references public.bookings(id),
  proposed_by uuid not null references public.profiles(id),
  is_client_proposal boolean not null,
  reason text not null,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'declined', 'expired')),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index uq_booking_open_cancellation on public.booking_cancellations(booking_id)
  where status = 'proposed';
alter table public.booking_cancellations enable row level security;
revoke all on public.booking_cancellations from public, anon, authenticated;

alter function public.frameroom_transition(uuid,public.booking_status,integer,text,timestamptz,timestamptz,uuid,uuid[])
  set schema private;
revoke all on function private.frameroom_transition(uuid,public.booking_status,integer,text,timestamptz,timestamptz,uuid,uuid[])
  from public, anon, authenticated, service_role;

create function public.frameroom_transition(
  bid uuid, desired public.booking_status, expected_version integer, reason text default '',
  starts timestamptz default null, ends timestamptz default null, assignee uuid default null,
  resources uuid[] default '{}'
) returns public.bookings language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  latest public.brief_versions;
begin
  select * into strict b from public.bookings where id = bid for update;
  if auth.uid() is null or not (private.provider_side(bid) or b.client_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if b.version <> expected_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  if desired in ('rejected', 'cancelled') and coalesce(length(btrim(reason)), 0) = 0 then
    raise exception 'reason_required' using errcode = '23514';
  end if;
  if desired = 'cancelled' and b.status <> 'pending' then
    raise exception 'mutual_cancellation_required' using errcode = '23514';
  end if;
  if desired = 'confirmed' and b.status = 'pending' then
    if not private.owns_provider(b.photographer_id,b.studio_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    select * into latest from public.brief_versions where booking_id = bid order by version desc limit 1;
    if not found or latest.status <> 'open' or not latest.client_approved or not latest.provider_approved then
      raise exception 'brief_required' using errcode = '23514';
    end if;
    if b.scheduled_start <= now() or (starts is not null and starts <> b.scheduled_start)
      or (ends is not null and ends <> b.scheduled_end) then
      raise exception 'invalid_interval' using errcode = '23514';
    end if;
    if b.assigned_photographer_id is null
      or (assignee is not null and assignee <> b.assigned_photographer_id) then
      raise exception 'invalid_assignment' using errcode = '23514';
    end if;
    if not exists (select 1 from public.photographers where id=b.assigned_photographer_id and not is_hidden) then
      raise exception 'invalid_assignment' using errcode = '23514';
    end if;
    update public.bookings set agreed_brief_version = latest.version where id = bid;
  end if;
  if desired = 'delivered' then
    update public.booking_cancellations set status = 'expired', decided_at = now()
      where booking_id = bid and status = 'proposed';
  end if;
  b := private.frameroom_transition(bid, desired, expected_version, reason, starts, ends, assignee, resources);
  insert into private.booking_events(booking_id, actor_id, event, details)
  values (bid, auth.uid(), desired::text, jsonb_build_object('reason', reason, 'briefVersion', b.agreed_brief_version));
  return b;
end;
$$;
revoke all on function public.frameroom_transition(uuid,public.booking_status,integer,text,timestamptz,timestamptz,uuid,uuid[])
  from public, anon, authenticated;
grant execute on function public.frameroom_transition(uuid,public.booking_status,integer,text,timestamptz,timestamptz,uuid,uuid[])
  to service_role;

-- Only the dedicated reassignment transaction may change the active assignee.
create or replace function public.frameroom_reschedule(
  bid uuid, expected_version integer, starts timestamptz, ends timestamptz,
  assignee uuid default null, resources uuid[] default '{}'
) returns public.bookings language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into strict b from public.bookings where id = bid for update;
  if not private.owns_provider(b.photographer_id,b.studio_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if b.version <> expected_version then raise exception 'stale_version' using errcode = '40001'; end if;
  if b.status not in ('confirmed','in_progress') then
    raise exception 'invalid_transition' using errcode = '23514';
  end if;
  if assignee is not null and assignee is distinct from b.assigned_photographer_id then
    raise exception 'invalid_assignment' using errcode = '23514';
  end if;
  if starts is distinct from b.scheduled_start or ends is distinct from b.scheduled_end then
    raise exception 'brief_required' using errcode = '23514';
  end if;
  perform private.reserve_booking(bid, starts, ends, b.assigned_photographer_id, resources);
  update public.bookings set version = version + 1 where id = bid returning * into b;
  insert into public.room_messages(room_id,sender_id,text,type)
    select id, auth.uid(), 'schedule_updated', 'system' from public.shoot_rooms where booking_id = bid;
  return b;
end;
$$;
