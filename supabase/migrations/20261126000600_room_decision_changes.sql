alter table public.room_decisions
  add column changes jsonb,
  add column booking_version integer,
  add column resolved_by uuid references public.profiles(id),
  add column resolved_at timestamptz;
