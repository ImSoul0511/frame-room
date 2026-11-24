alter table public.photographers
  add column cover_path text
  check (cover_path is null or (length(cover_path) <= 500 and cover_path like user_id::text || '/%'));
