alter table public.tags add column if not exists is_active boolean not null default true;

alter table public.services
  add column billing_unit text not null default 'package'
    check (billing_unit in ('package', 'hour', 'sku', 'dish', 'day')),
  add column proofing_mode text check (proofing_mode in ('select', 'album', 'print'));

alter table public.services drop constraint if exists services_selection_quota_check;
alter table public.services add constraint services_selection_quota_check
  check (selection_quota between 0 and 200);

create table public.conversation_quotes (
  id uuid primary key default public.uuid_generate_v7(),
  conversation_id uuid not null references public.conversations(id),
  author_id uuid not null references public.profiles(id),
  version integer not null check (version > 0),
  terms jsonb not null check (jsonb_typeof(terms) = 'object'),
  created_at timestamptz not null default now(),
  unique (conversation_id, version)
);
alter table public.conversation_quotes enable row level security;
create policy conversation_quotes_read on public.conversation_quotes for select to authenticated
  using (private.can_read_conversation(conversation_id));
revoke all on public.conversation_quotes from public, anon, authenticated;
grant select on public.conversation_quotes to authenticated;
grant all on public.conversation_quotes to service_role;

alter table public.bookings alter column service_id drop not null;
alter table public.bookings
  add column quote_id uuid unique references public.conversation_quotes(id),
  add column quantity integer not null default 1 check (quantity between 1 and 1000),
  add constraint bookings_one_price_source check (num_nonnulls(service_id, quote_id) = 1);

create function private.sync_photographer_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'profiles' then
    update public.photographers set display_name = new.display_name
      where user_id = new.id and display_name is distinct from new.display_name;
  else
    select p.display_name into new.display_name from public.profiles p where p.id = new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_photographer_name() from public;

update public.photographers ph set display_name = p.display_name
  from public.profiles p where p.id = ph.user_id and ph.display_name is distinct from p.display_name;
create trigger profile_name_to_photographer after update of display_name on public.profiles
  for each row when (old.display_name is distinct from new.display_name)
  execute function private.sync_photographer_name();
create trigger photographer_name_from_profile before insert or update of display_name on public.photographers
  for each row execute function private.sync_photographer_name();
