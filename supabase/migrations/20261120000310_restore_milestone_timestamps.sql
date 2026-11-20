-- Complete the compatibility bridge immediately after the agreement migration.
-- Disable only the timestamp trigger while restoring the original timestamps.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='room_milestones' and column_name='replay_updated_at'
  ) then
    alter table public.room_milestones disable trigger touch_updated_at;
    update public.room_milestones set updated_at = replay_updated_at;
    alter table public.room_milestones alter column updated_at set default now();
    alter table public.room_milestones alter column updated_at set not null;
    alter table public.room_milestones enable trigger touch_updated_at;
    alter table public.room_milestones drop column replay_updated_at;
  end if;
end;
$$;
