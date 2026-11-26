alter table public.gallery_images add column proof_round integer not null default 1
  check (proof_round > 0);
alter table public.galleries add column approved_round integer;
create table public.gallery_round_notes (
  gallery_id uuid not null references public.galleries(id),
  round integer not null check (round > 0),
  note text not null check (length(note) <= 2000),
  primary key (gallery_id, round)
);
alter table public.gallery_round_notes enable row level security;
revoke all on public.gallery_round_notes from public, anon, authenticated;
grant all on public.gallery_round_notes to service_role;

alter table public.deliveries add column size_bytes bigint;
update storage.buckets
  set file_size_limit = 52428800,
      allowed_mime_types = array['image/webp','image/jpeg','image/png','application/zip',
        'application/octet-stream']
  where id = 'deliveries';

create function private.check_delivery_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.service_snapshot ? 'proofingMode' and new.status = 'delivered' and old.status = 'proofing' then
    if not exists (
      select 1 from public.galleries g where g.booking_id = new.id and g.approved_round = g.round
        and g.revision_requested_at is null and exists (
          select 1 from public.deliveries d where d.booking_id = new.id and d.selection_round = g.round
        )
    ) then raise exception 'selection_delivery_required' using errcode = '23514'; end if;
    if new.studio_id is not null and not exists (
      select 1 from public.booking_attendance a where a.booking_id = new.id
    ) then raise exception 'invalid_assignment' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.check_delivery_approval() from public;
create trigger delivery_approval before update of status on public.bookings
  for each row execute function private.check_delivery_approval();
