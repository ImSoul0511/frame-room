alter table public.photographers
  add column contact_email text,
  add column professional_roles text[] not null default '{}'
    check (professional_roles <@ array['photographer','retoucher','art_director']);

alter table public.studios add column contact_email text;
alter table public.services
  add column selection_quota integer check (selection_quota between 1 and 200),
  add column revision_limit integer check (revision_limit between 0 and 100);

alter table public.galleries add column revision_requested_at timestamptz;
alter table public.deliveries add column selection_round integer check (selection_round > 0);
update public.deliveries d set selection_round=g.round from public.galleries g
where d.booking_id=g.booking_id;

create function private.validate_delivery_round() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.galleries g join public.deliveries d on d.booking_id=g.booking_id
    where g.booking_id=new.id and d.selection_round=g.round and g.revision_requested_at is null
  ) then
    raise exception 'selection_delivery_required' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validate_delivery_round before update of status on public.bookings
  for each row when (old.status is distinct from new.status and new.status='delivered')
  execute function private.validate_delivery_round();

create table public.photo_feedback (
  id uuid primary key default public.uuid_generate_v7(),
  image_id uuid not null references public.gallery_images(id),
  round integer not null check (round > 0),
  author_id uuid not null references public.profiles(id),
  note text not null check (length(btrim(note)) between 1 and 1000),
  x double precision,
  y double precision,
  created_at timestamptz not null default now(),
  constraint chk_photo_feedback_position check (num_nonnulls(x,y) = 0 or
    (num_nonnulls(x,y) = 2 and x between 0 and 1 and y between 0 and 1))
);
create index idx_photo_feedback_image_round on public.photo_feedback(image_id,round);
alter table public.photo_feedback enable row level security;
revoke all on public.photo_feedback from public, anon, authenticated;
grant select on public.photo_feedback to authenticated;
create policy photo_feedback_read on public.photo_feedback for select to authenticated
  using (exists(select 1 from public.gallery_images i where i.id=image_id and private.can_read_gallery(i.gallery_id)));
