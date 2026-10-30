-- MVP-001. API writes use server credentials after verified identity and explicit checks.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists vector with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create function public.uuid_generate_v7() returns uuid language plpgsql volatile
set search_path = '' as $$
declare h text := lpad(to_hex(floor(extract(epoch from clock_timestamp()) * 1000)::bigint),12,'0');
r text := encode(extensions.gen_random_bytes(10),'hex');
begin
  return (h || '7' || substr(r,1,3) || substr('89ab',1+(get_byte(decode(substr(r,4,2),'hex'),0)%4),1) || substr(r,6,15))::uuid;
end $$;

create type public.genre as enum ('portrait','fashion','wedding','family','product','food','event','cosplay');
create type public.provider_type as enum ('photographer','studio');
create type public.provenance as enum ('captured','manipulated','ai_generated');
create type public.booking_status as enum ('pending','confirmed','rejected','cancelled','in_progress','proofing','delivered','completed');
create type public.studio_member_role as enum ('manager','photographer');
create type public.invitation_status as enum ('pending','accepted','declined','revoked');
create type public.portfolio_status as enum ('draft','published','hidden');
create type public.resource_type as enum ('room','equipment');
create type public.job_kind as enum ('concept','edit','cull','index');
create type public.job_status as enum ('queued','running','succeeded','failed','uncertain');
create type public.tag_kind as enum ('tone','setting','mood');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 user_name text not null unique check (user_name ~ '^[a-z0-9][a-z0-9_]{2,29}$'),
 display_name text not null check (length(display_name) between 1 and 60),
 avatar_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
 user_id uuid primary key references public.profiles(id), role text not null check (role='system_admin'), granted_at timestamptz not null default now()
);
create table public.photographers (
 id uuid primary key default public.uuid_generate_v7(), user_id uuid not null unique references public.profiles(id),
 display_name text not null check(length(display_name) between 1 and 60), bio text not null default '',
 city text not null default '', district text not null default '', genres public.genre[] not null check(cardinality(genres) between 1 and 5),
 styles text[] not null default '{}', is_hidden boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.studios (
 id uuid primary key default public.uuid_generate_v7(), name text not null check(length(name) between 1 and 80),
 description text not null default '', city text not null default '', district text not null default '', address text not null default '',
 genres public.genre[] not null, created_by uuid not null references public.photographers(user_id),
 is_hidden boolean not null default false, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.studio_members (
 studio_id uuid not null references public.studios(id), user_id uuid not null references public.photographers(user_id),
 role public.studio_member_role not null, joined_at timestamptz not null default now(), primary key(studio_id,user_id)
);
create table public.studio_invitations (
 id uuid primary key default public.uuid_generate_v7(), studio_id uuid not null references public.studios(id),
 photographer_id uuid not null references public.photographers(id), role public.studio_member_role not null default 'photographer',
 status public.invitation_status not null default 'pending', invited_by uuid not null references public.profiles(id), responded_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index uq_pending_invitation on public.studio_invitations(studio_id,photographer_id) where status='pending';
create table public.services (
 id uuid primary key default public.uuid_generate_v7(), owner_type public.provider_type not null,
 photographer_id uuid references public.photographers(id), studio_id uuid references public.studios(id),
 name text not null, description text not null default '', genre public.genre not null,
 duration_minutes integer not null check(duration_minutes between 15 and 1440), price integer not null check(price>=0),
 photo_count integer not null default 10 check(photo_count>=0), retouched_count integer not null default 5 check(retouched_count>=0),
 is_active boolean not null default true, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((owner_type='photographer' and photographer_id is not null and studio_id is null) or (owner_type='studio' and studio_id is not null and photographer_id is null))
);
create table public.service_add_ons (
 id uuid primary key default public.uuid_generate_v7(), service_id uuid not null references public.services(id), name text not null,
 description text not null default '', price integer not null check(price>=0), is_active boolean not null default true, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.studio_resources (
 id uuid primary key default public.uuid_generate_v7(), studio_id uuid not null references public.studios(id),
 name text not null, type public.resource_type not null, description text not null default '', is_active boolean not null default true, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.portfolios (
 id uuid primary key default public.uuid_generate_v7(), owner_type public.provider_type not null,
 photographer_id uuid references public.photographers(id), studio_id uuid references public.studios(id),
 title text not null, description text not null default '', genre public.genre not null, status public.portfolio_status not null default 'draft',
 published_at timestamptz, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((owner_type='photographer' and photographer_id is not null and studio_id is null) or (owner_type='studio' and studio_id is not null and photographer_id is null))
);
create table public.portfolio_images (
 id uuid primary key default public.uuid_generate_v7(), portfolio_id uuid not null references public.portfolios(id),
 storage_path text not null unique, width integer not null check(width between 1 and 1280), height integer not null check(height between 1 and 1280),
 caption text not null default '', provenance public.provenance not null default 'captured', sort_order integer not null default 0,
 is_hidden boolean not null default false, source text, collected_at timestamptz, license_note text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tags (
 id uuid primary key default public.uuid_generate_v7(), slug text not null unique, name text not null, kind public.tag_kind not null
);
create table public.image_tags (
 portfolio_image_id uuid not null references public.portfolio_images(id), tag_id uuid not null references public.tags(id),
 source text not null check(source in ('manual','ai')), confidence real check(confidence between 0 and 1), primary key(portfolio_image_id,tag_id)
);
create table public.creative_projects (
 id uuid primary key default public.uuid_generate_v7(), owner_id uuid not null references public.profiles(id), title text not null,
 idea text not null, brief jsonb, reference_paths text[] not null default '{}', version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.bookings (
 id uuid primary key default public.uuid_generate_v7(), client_id uuid not null references public.profiles(id),
 project_id uuid not null unique references public.creative_projects(id), service_id uuid not null references public.services(id),
 owner_type public.provider_type not null, photographer_id uuid references public.photographers(id), studio_id uuid references public.studios(id),
 assigned_photographer_id uuid references public.photographers(id), status public.booking_status not null default 'pending',
 scheduled_start timestamptz not null, scheduled_end timestamptz not null, total_price integer not null check(total_price>=0), service_name text not null,
 service_snapshot jsonb not null, note text not null default '', version integer not null default 1, agreed_brief_version integer,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(scheduled_end>scheduled_start),
 check((owner_type='photographer' and photographer_id is not null and studio_id is null) or (owner_type='studio' and studio_id is not null and photographer_id is null))
);
create table public.schedule_entries (
 id uuid primary key default public.uuid_generate_v7(), booking_id uuid references public.bookings(id),
 photographer_id uuid references public.photographers(id), resource_id uuid references public.studio_resources(id),
 during tstzrange not null, label text not null default '', created_at timestamptz not null default now(),
 check(num_nonnulls(photographer_id,resource_id)=1),
 check(not isempty(during) and lower(during) is not null and upper(during) is not null and lower(during)<upper(during) and lower_inc(during) and not upper_inc(during)),
 exclude using gist(photographer_id with =, during with &&) where (photographer_id is not null),
 exclude using gist(resource_id with =, during with &&) where (resource_id is not null)
);
create table public.booking_resources (
 booking_id uuid not null references public.bookings(id), resource_id uuid not null references public.studio_resources(id),
 name text not null, type public.resource_type not null, primary key(booking_id,resource_id)
);
create table public.brief_versions (
 id uuid primary key default public.uuid_generate_v7(), booking_id uuid not null references public.bookings(id), version integer not null,
 content jsonb not null, created_by uuid not null references public.profiles(id), client_approved boolean not null default false,
 provider_approved boolean not null default false, created_at timestamptz not null default now(), unique(booking_id,version)
);
create table public.shoot_rooms (
 id uuid primary key default public.uuid_generate_v7(), booking_id uuid not null unique references public.bookings(id),
 status text not null default 'open' check(status in ('open','closed')), created_at timestamptz not null default now()
);
create table public.room_messages (
 id uuid primary key default public.uuid_generate_v7(), room_id uuid not null references public.shoot_rooms(id),
 sender_id uuid references public.profiles(id), text text not null, storage_path text,
 type text not null default 'text' check(type in ('text','image','system')), is_hidden boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.room_decisions (
 id uuid primary key default public.uuid_generate_v7(), room_id uuid not null references public.shoot_rooms(id),
 title text not null, description text not null default '', proposed_by uuid not null references public.profiles(id),
 status text not null default 'proposed' check(status in ('proposed','agreed','rejected')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.room_milestones (
 id uuid primary key default public.uuid_generate_v7(), room_id uuid not null references public.shoot_rooms(id), title text not null,
 due_at timestamptz, status text not null default 'todo' check(status in ('todo','done')), created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.galleries (
 id uuid primary key default public.uuid_generate_v7(), booking_id uuid not null unique references public.bookings(id),
 status text not null default 'draft' check(status in ('draft','open_for_selection','selection_submitted','finalized')),
 round integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.gallery_images (
 id uuid primary key default public.uuid_generate_v7(), gallery_id uuid not null references public.galleries(id), storage_path text not null unique,
 caption text not null default '', provenance public.provenance not null default 'captured', width integer not null, height integer not null,
 created_at timestamptz not null default now()
);
create table public.gallery_selections (
 gallery_id uuid not null references public.galleries(id), image_id uuid not null references public.gallery_images(id),
 round integer not null, selected_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), primary key(gallery_id,image_id,round)
);
create table public.deliveries (
 id uuid primary key default public.uuid_generate_v7(), booking_id uuid not null references public.bookings(id), storage_path text not null unique,
 file_name text not null, mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 created_at timestamptz not null default now()
);
create table public.reviews (
 id uuid primary key default public.uuid_generate_v7(), booking_id uuid not null unique references public.bookings(id), author_id uuid not null references public.profiles(id),
 photographer_id uuid references public.photographers(id), studio_id uuid references public.studios(id), rating integer not null check(rating between 1 and 5),
 comment text not null default '', is_hidden boolean not null default false, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.content_reports (
 id uuid primary key default public.uuid_generate_v7(), reporter_id uuid not null references public.profiles(id), target_type text not null,
 target_id uuid not null, reason text not null, description text not null, status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ai_messages (
 id uuid primary key default public.uuid_generate_v7(), project_id uuid not null references public.creative_projects(id),
 user_id uuid not null references public.profiles(id), role text not null check(role in ('user','assistant')), content text not null,
 created_at timestamptz not null default now()
);
create table public.ai_jobs (
 id uuid primary key default public.uuid_generate_v7(), project_id uuid references public.creative_projects(id), user_id uuid not null references public.profiles(id),
 kind public.job_kind not null, status public.job_status not null default 'queued', input jsonb not null, result jsonb, error text,
 request_key uuid not null unique, started_at timestamptz, completed_at timestamptz, provider_started_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ai_artifacts (
 id uuid primary key default public.uuid_generate_v7(), project_id uuid not null references public.creative_projects(id),
 job_id uuid not null unique references public.ai_jobs(id), storage_path text not null unique, provenance public.provenance not null,
 original_image_id uuid references public.gallery_images(id), prompt text not null, created_at timestamptz not null default now()
);
create table public.image_embeddings (
 image_id uuid primary key references public.portfolio_images(id), description text not null, model text not null,
 embedding extensions.vector(768) not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ai_usage (
 id uuid primary key default public.uuid_generate_v7(), user_id uuid not null references public.profiles(id), job_id uuid references public.ai_jobs(id),
 feature text not null, model text not null, reserved_usd numeric(12,6) not null check(reserved_usd>=0), actual_usd numeric(12,6),
 status text not null default 'reserved' check(status in ('reserved','completed','uncertain','released')), image_count integer not null default 0,
 input_tokens integer, output_tokens integer, created_at timestamptz not null default now()
);
create table public.ai_actions (
 id uuid primary key default public.uuid_generate_v7(), project_id uuid not null references public.creative_projects(id), proposed_for uuid not null references public.profiles(id),
 kind text not null check(kind in ('update_brief','create_milestone','request_booking','reschedule_booking','assign_photographer')),
 explanation text not null, payload jsonb not null, status text not null default 'proposed' check(status in ('proposed','applied','rejected')),
 project_version integer not null, booking_version integer, expires_at timestamptz not null default now()+interval '15 minutes',
 applied_by uuid references public.profiles(id), applied_at timestamptz, created_at timestamptz not null default now()
);

create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles where user_id=auth.uid() and role='system_admin'); $$;
create function private.is_manager(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.studio_members m join public.studios s on s.id=m.studio_id where m.studio_id=sid and m.user_id=auth.uid() and m.role='manager' and s.deleted_at is null); $$;
create function private.owns_provider(pid uuid,sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.photographers where id=pid and user_id=auth.uid()) or private.is_manager(sid); $$;
create function private.provider_visible(pid uuid,sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.photographers where id=pid and not is_hidden) or exists(select 1 from public.studios where id=sid and not is_hidden and deleted_at is null); $$;
create function private.provider_side(bid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bookings b where b.id=bid and (private.is_manager(b.studio_id) or exists(select 1 from public.photographers p where p.id=coalesce(b.assigned_photographer_id,b.photographer_id) and p.user_id=auth.uid()))); $$;
create function private.can_read_booking(bid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bookings where id=bid and client_id=auth.uid()) or private.provider_side(bid); $$;
create function private.can_read_project(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.creative_projects where id=pid and owner_id=auth.uid()) or exists(select 1 from public.bookings where project_id=pid and private.provider_side(id)); $$;
create function private.can_read_room(rid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shoot_rooms where id=rid and private.can_read_booking(booking_id)); $$;
create function private.can_read_gallery(gid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.galleries where id=gid and private.can_read_booking(booking_id) and (status<>'draft' or private.provider_side(booking_id))); $$;

-- Browsers may read only permitted rows; business writes are API-only.
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','photographers','studios','studio_members','studio_invitations','services','service_add_ons','studio_resources','portfolios','portfolio_images','tags','image_tags','creative_projects','bookings','schedule_entries','booking_resources','brief_versions','shoot_rooms','room_messages','room_decisions','room_milestones','galleries','gallery_images','gallery_selections','deliveries','reviews','content_reports','ai_messages','ai_jobs','ai_artifacts','image_embeddings','ai_usage','ai_actions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy profiles_read on public.profiles for select using(true);
create policy roles_read on public.user_roles for select using(user_id=auth.uid());
create policy photographers_read on public.photographers for select using(not is_hidden or user_id=auth.uid() or private.is_admin());
create policy studios_read on public.studios for select using((not is_hidden and deleted_at is null) or private.is_manager(id) or private.is_admin());
create policy members_read on public.studio_members for select using(user_id=auth.uid() or private.is_manager(studio_id));
create policy invitations_read on public.studio_invitations for select using(private.is_manager(studio_id) or exists(select 1 from public.photographers where id=photographer_id and user_id=auth.uid()));
create policy services_read on public.services for select using((is_active and deleted_at is null and private.provider_visible(photographer_id,studio_id)) or private.owns_provider(photographer_id,studio_id));
create policy addons_read on public.service_add_ons for select using(exists(select 1 from public.services where id=service_id));
create policy resources_read on public.studio_resources for select using(private.is_manager(studio_id));
create policy portfolios_read on public.portfolios for select using((status='published' and deleted_at is null and private.provider_visible(photographer_id,studio_id)) or private.owns_provider(photographer_id,studio_id) or private.is_admin());
create policy images_read on public.portfolio_images for select using((not is_hidden or private.is_admin()) and exists(select 1 from public.portfolios where id=portfolio_id));
create policy tags_read on public.tags for select using(true);
create policy image_tags_read on public.image_tags for select using(exists(select 1 from public.portfolio_images where id=portfolio_image_id));
create policy projects_read on public.creative_projects for select using(private.can_read_project(id));
create policy bookings_read on public.bookings for select using(private.can_read_booking(id));
create policy schedule_read on public.schedule_entries for select using(private.can_read_booking(booking_id) or private.owns_provider(photographer_id,null) or exists(select 1 from public.studio_resources where id=resource_id and private.is_manager(studio_id)));
create policy snapshots_read on public.booking_resources for select using(private.can_read_booking(booking_id));
create policy briefs_read on public.brief_versions for select using(private.can_read_booking(booking_id));
create policy rooms_read on public.shoot_rooms for select using(private.can_read_booking(booking_id));
create policy messages_read on public.room_messages for select using((not is_hidden or private.is_admin()) and private.can_read_room(room_id));
create policy decisions_read on public.room_decisions for select using(private.can_read_room(room_id));
create policy milestones_read on public.room_milestones for select using(private.can_read_room(room_id));
create policy galleries_read on public.galleries for select using(private.can_read_gallery(id));
create policy gallery_images_read on public.gallery_images for select using(private.can_read_gallery(gallery_id));
create policy selections_read on public.gallery_selections for select using(private.can_read_gallery(gallery_id));
create policy deliveries_read on public.deliveries for select using(private.can_read_booking(booking_id) and exists(select 1 from public.bookings where id=booking_id and (status in ('delivered','completed') or private.provider_side(id))));
create policy reviews_read on public.reviews for select using((not is_hidden and deleted_at is null) or author_id=auth.uid() or private.is_admin());
create policy reports_read on public.content_reports for select using(reporter_id=auth.uid() or private.is_admin());
create policy ai_messages_read on public.ai_messages for select using(private.can_read_project(project_id));
create policy ai_jobs_read on public.ai_jobs for select using(user_id=auth.uid() and (project_id is null or private.can_read_project(project_id)));
create policy artifacts_read on public.ai_artifacts for select using(private.can_read_project(project_id));
create policy usage_read on public.ai_usage for select using(user_id=auth.uid() or private.is_admin());
create policy actions_read on public.ai_actions for select using(proposed_for=auth.uid() and private.can_read_project(project_id));
-- Embeddings are internal: no browser policy.

create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','photographers','studios','studio_invitations','services','service_add_ons','studio_resources','portfolios','portfolio_images','creative_projects','bookings','room_decisions','room_milestones','galleries','reviews','content_reports','ai_jobs','image_embeddings'] loop
 execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
 end loop;
end $$;
create function private.require_manager() returns trigger language plpgsql set search_path='' as $$
declare sid uuid; begin
 sid=coalesce(new.studio_id,old.studio_id);
 perform 1 from public.studios where id=sid for update;
 if exists(select 1 from public.studios where id=sid and deleted_at is null) and not exists(select 1 from public.studio_members where studio_id=sid and role='manager') then
 raise exception 'last_manager' using errcode='23514'; end if; return null;
end $$;
create constraint trigger require_manager after insert or update or delete on public.studio_members deferrable initially deferred for each row execute function private.require_manager();

create index idx_photographers_city on public.photographers(city,district);
create index idx_photographers_genres on public.photographers using gin(genres);
create index idx_studios_city on public.studios(city,district);
create index idx_members_user on public.studio_members(user_id);
create index idx_portfolio_provider on public.portfolios(photographer_id,studio_id,status);
create index idx_images_portfolio on public.portfolio_images(portfolio_id,sort_order);
create index idx_services_provider on public.services(photographer_id,studio_id);
create index idx_projects_owner on public.creative_projects(owner_id);
create index idx_bookings_client on public.bookings(client_id);
create index idx_bookings_assignment on public.bookings(assigned_photographer_id,studio_id);
create index idx_messages_room_cursor on public.room_messages(room_id,created_at,id);
create index idx_ai_jobs_status on public.ai_jobs(status,created_at);
create index idx_usage_month on public.ai_usage(created_at);
create index idx_actions_project on public.ai_actions(project_id);
create index idx_ai_messages_project on public.ai_messages(project_id,created_at);

revoke all on all functions in schema private from public;
grant execute on function private.is_admin(),private.is_manager(uuid),private.owns_provider(uuid,uuid),private.provider_visible(uuid,uuid),private.provider_side(uuid),private.can_read_booking(uuid),private.can_read_project(uuid),private.can_read_room(uuid),private.can_read_gallery(uuid) to authenticated,anon,service_role;
grant usage on schema private to anon;
