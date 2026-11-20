-- The core migration already owns updated_at. The following historical agreement
-- migration adds it again. Preserve its values across that DDL on a fresh replay.
-- Existing databases that already applied the agreement migration are untouched.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='room_milestones' and column_name='updated_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='room_milestones' and column_name='updated_by'
  ) then
    alter table public.room_milestones rename column updated_at to replay_updated_at;
  end if;
end;
$$;
