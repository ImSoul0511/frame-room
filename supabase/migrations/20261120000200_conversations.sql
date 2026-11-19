create table public.conversations (
  id uuid primary key default public.uuid_generate_v7(),
  client_id uuid not null references public.profiles(id),
  photographer_id uuid references public.photographers(id),
  studio_id uuid references public.studios(id),
  created_at timestamptz not null default now(),
  constraint chk_conversation_provider check (num_nonnulls(photographer_id, studio_id) = 1),
  constraint uq_conversation_pair unique nulls not distinct (client_id, photographer_id, studio_id)
);

create index idx_conversations_photographer on public.conversations(photographer_id);
create index idx_conversations_studio on public.conversations(studio_id);
alter table public.bookings add column conversation_id uuid references public.conversations(id);
create index idx_bookings_conversation on public.bookings(conversation_id);

alter table public.room_messages
  alter column room_id drop not null,
  add column conversation_id uuid references public.conversations(id),
  add column submission_id uuid,
  add constraint uq_message_submission unique (sender_id, submission_id);
create index idx_room_messages_conversation_timeline
  on public.room_messages(conversation_id, created_at desc, id desc);

create function private.link_bookings_to_conversation() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.bookings b set conversation_id = new.id
   where b.client_id = new.client_id
     and b.photographer_id is not distinct from new.photographer_id
     and b.studio_id is not distinct from new.studio_id
     and b.conversation_id is null;
  update public.room_messages m set conversation_id = new.id
   from public.shoot_rooms r join public.bookings b on b.id = r.booking_id
   where m.room_id = r.id and b.conversation_id = new.id and m.conversation_id is null;
  return new;
end;
$$;
create trigger link_bookings_to_conversation
  after insert on public.conversations
  for each row execute function private.link_bookings_to_conversation();

create function private.set_booking_conversation() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Serialize pair creation and booking creation so either insert can link the other.
  perform pg_advisory_xact_lock(hashtextextended(
    new.client_id::text || ':' || coalesce(new.photographer_id, new.studio_id)::text, 0));
  select c.id into new.conversation_id from public.conversations c
   where c.client_id = new.client_id
     and c.photographer_id is not distinct from new.photographer_id
     and c.studio_id is not distinct from new.studio_id;
  return new;
end;
$$;
create trigger set_booking_conversation
  before insert on public.bookings
  for each row execute function private.set_booking_conversation();

-- Historical messages keep their original IDs, timestamps, room and Storage paths.
insert into public.conversations(client_id, photographer_id, studio_id)
select distinct b.client_id, b.photographer_id, b.studio_id
from public.bookings b join public.shoot_rooms r on r.booking_id = b.id
join public.room_messages m on m.room_id = r.id and m.type <> 'system'
on conflict on constraint uq_conversation_pair do nothing;

update public.room_messages m set conversation_id = b.conversation_id
from public.shoot_rooms r join public.bookings b on b.id = r.booking_id
where m.room_id = r.id and b.conversation_id is not null;

alter table public.room_messages add constraint chk_message_context
  check (room_id is not null or conversation_id is not null);

create function private.can_read_conversation(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversations c where c.id = cid
    and (c.client_id = auth.uid() or private.owns_provider(c.photographer_id, c.studio_id)));
$$;

create function private.can_read_conversation_message(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_messages m
    left join public.shoot_rooms r on r.id = m.room_id
    where m.id = mid and not m.is_hidden and (
      (m.room_id is null and private.can_read_conversation(m.conversation_id))
      or (m.room_id is not null and private.can_read_booking(r.booking_id)
        and (private.can_read_conversation(m.conversation_id) or private.can_read_room(r.id)))
    )
  );
$$;

alter table public.conversations enable row level security;
revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;
create policy conversations_read on public.conversations for select to authenticated
  using (private.can_read_conversation(id));

revoke all on function private.can_read_conversation(uuid),
  private.can_read_conversation_message(uuid) from public, anon;
grant execute on function private.can_read_conversation(uuid),
  private.can_read_conversation_message(uuid) to authenticated, service_role;

create or replace function private.can_read_room(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shoot_rooms r join public.bookings b on b.id = r.booking_id
    where r.id = rid and b.status in ('confirmed', 'in_progress')
      and private.can_read_booking(b.id));
$$;

drop policy if exists messages_read on public.room_messages;
create policy conversation_messages_read on public.room_messages for select to authenticated
  using (private.can_read_conversation_message(id));

drop policy rooms_read on public.shoot_rooms;
create policy rooms_read on public.shoot_rooms for select to authenticated
  using (private.can_read_room(id));

create function private.set_room_message_conversation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.room_id is not null then
    select b.conversation_id into new.conversation_id
    from public.shoot_rooms r join public.bookings b on b.id = r.booking_id
    where r.id = new.room_id;
  end if;
  return new;
end;
$$;
create trigger set_room_message_conversation before insert on public.room_messages
  for each row execute function private.set_room_message_conversation();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('conversation-files', 'conversation-files', false, 2097152, array['image/webp']);
