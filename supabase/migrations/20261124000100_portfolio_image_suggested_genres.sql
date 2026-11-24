-- Preserve dataset labels from the supplied schema alongside the MVP image fields.
alter table public.portfolio_images
  add column if not exists suggested_genre text;

alter table public.portfolio_images
  drop constraint if exists portfolio_images_suggested_genre_check;

alter table public.portfolio_images
  add constraint portfolio_images_suggested_genre_check
  check (suggested_genre is null or suggested_genre = any (array[
    'portrait', 'fashion', 'wedding', 'family', 'product', 'food', 'event', 'cosplay',
    'drink', 'yearbook', 'outdoor', 'tet_holiday'
  ]::text[]));
