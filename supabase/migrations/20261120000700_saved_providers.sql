create table public.saved_providers (
  id uuid primary key default public.uuid_generate_v7(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  photographer_id uuid references public.photographers(id) on delete cascade,
  studio_id uuid references public.studios(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_saved_providers_target check (num_nonnulls(photographer_id,studio_id)=1),
  constraint uq_saved_providers_photographer unique(user_id,photographer_id),
  constraint uq_saved_providers_studio unique(user_id,studio_id)
);
create index idx_saved_providers_user_created on public.saved_providers(user_id,created_at desc,id);
create index idx_saved_providers_photographer on public.saved_providers(photographer_id) where photographer_id is not null;
create index idx_saved_providers_studio on public.saved_providers(studio_id) where studio_id is not null;
create trigger touch_updated_at before update on public.saved_providers
  for each row execute function private.touch_updated_at();
alter table public.saved_providers enable row level security;
revoke all on public.saved_providers from public,anon,authenticated;
grant select on public.saved_providers to authenticated;
grant select,insert,update,delete on public.saved_providers to service_role;
create policy saved_providers_owner_read on public.saved_providers for select to authenticated
  using (user_id=auth.uid());
-- Writes stay API-mediated; a saved provider never grants access to private work.
