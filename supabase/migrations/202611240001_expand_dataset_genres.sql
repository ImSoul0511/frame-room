-- Run after 202611160001_demo_image_intake.sql in the intended project's SQL Editor.
-- Extend the shared genre enum used by photographer arrays, portfolios and sets.
-- The new enum values are not used in enum-typed writes in this transaction.
BEGIN;

ALTER TYPE public.genre ADD VALUE IF NOT EXISTS 'drink';
ALTER TYPE public.genre ADD VALUE IF NOT EXISTS 'yearbook';
ALTER TYPE public.genre ADD VALUE IF NOT EXISTS 'outdoor';
ALTER TYPE public.genre ADD VALUE IF NOT EXISTS 'tet_holiday';

-- suggested_genre is text, so its check must be extended separately.
ALTER TABLE public.portfolio_images
  DROP CONSTRAINT IF EXISTS portfolio_images_suggested_genre_check;
ALTER TABLE public.portfolio_images
  ADD CONSTRAINT portfolio_images_suggested_genre_check
  CHECK (suggested_genre IS NULL OR suggested_genre IN (
    'portrait', 'fashion', 'wedding', 'family', 'product', 'food', 'event', 'cosplay',
    'drink', 'yearbook', 'outdoor', 'tet_holiday'
  ));

NOTIFY pgrst, 'reload schema';
COMMIT;
