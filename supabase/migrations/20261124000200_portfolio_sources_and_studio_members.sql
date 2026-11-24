-- Older installations did not receive these fields or the updated profile references.
alter table public.portfolio_images
  add column if not exists source text,
  add column if not exists collected_at timestamptz,
  add column if not exists license_note text;

alter table public.studios drop constraint if exists studios_created_by_fkey;
alter table public.studios
  add constraint studios_created_by_fkey foreign key (created_by) references public.profiles(id);

alter table public.studio_members drop constraint if exists studio_members_user_id_fkey;
alter table public.studio_members
  add constraint studio_members_user_id_fkey foreign key (user_id) references public.profiles(id);
