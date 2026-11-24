alter table public.creative_projects add column deleted_at timestamptz;

create or replace function private.can_read_project(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.creative_projects p
    where p.id = pid and p.deleted_at is null and (
      p.owner_id = auth.uid() or exists (
        select 1 from public.bookings b where b.project_id = p.id and private.provider_side(b.id)
      )
    )
  );
$$;
