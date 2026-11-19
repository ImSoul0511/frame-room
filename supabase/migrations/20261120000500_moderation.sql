alter table public.content_reports
  add column outcome text check (outcome in ('actioned', 'dismissed'));

alter table public.reviews
  add column moderation_reason text,
  add column reassessment_requested_at timestamptz;
create index idx_reviews_reassessment on public.reviews(reassessment_requested_at, id)
  where reassessment_requested_at is not null;

create table private.moderation_events (
  id uuid primary key default public.uuid_generate_v7(),
  report_id uuid references public.content_reports(id),
  target_type text not null,
  target_id uuid not null,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  reason text not null,
  previous_review jsonb,
  created_at timestamptz not null default now()
);
create index idx_moderation_events_target on private.moderation_events(target_type, target_id, created_at);
create index idx_moderation_events_report on private.moderation_events(report_id, created_at);
alter table private.moderation_events enable row level security;
revoke all on private.moderation_events from public, anon, authenticated;

create function private.require_publishable_portfolio() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' and not exists (
    select 1 from public.portfolio_images where portfolio_id=new.id and not is_hidden
  ) then
    raise exception 'portfolio_image_required' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger require_publishable_portfolio before insert or update of status on public.portfolios
  for each row execute function private.require_publishable_portfolio();

alter table public.portfolio_images add column crew_credits text not null default '';
update storage.buckets set public=false where id='portfolio-images';
