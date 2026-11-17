-- Run AFTER portfolio_dataset_setup.sql. Additive; no image/tag assignments are removed.
BEGIN;

ALTER TABLE public.photographers ADD COLUMN IF NOT EXISTS dataset_key text;
CREATE UNIQUE INDEX IF NOT EXISTS photographers_dataset_key_uidx
  ON public.photographers (dataset_key) WHERE dataset_key IS NOT NULL;

ALTER TABLE public.portfolio_images
  ADD COLUMN IF NOT EXISTS dataset_key text,
  ADD COLUMN IF NOT EXISTS content_sha256 text,
  ADD COLUMN IF NOT EXISTS suggested_genre text,
  ADD COLUMN IF NOT EXISTS label_status text NOT NULL DEFAULT 'unlabeled',
  ADD COLUMN IF NOT EXISTS import_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS portfolio_images_dataset_key_uidx
  ON public.portfolio_images (dataset_key);
CREATE UNIQUE INDEX IF NOT EXISTS portfolio_images_content_sha256_uidx
  ON public.portfolio_images (content_sha256) WHERE content_sha256 IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.portfolio_images'::regclass
      AND conname = 'portfolio_images_label_status_check') THEN
    ALTER TABLE public.portfolio_images ADD CONSTRAINT portfolio_images_label_status_check
      CHECK (label_status IN ('unlabeled', 'suggested', 'reviewed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.portfolio_images'::regclass
      AND conname = 'portfolio_images_suggested_genre_check') THEN
    ALTER TABLE public.portfolio_images ADD CONSTRAINT portfolio_images_suggested_genre_check
      CHECK (suggested_genre IS NULL OR suggested_genre IN
        ('portrait', 'fashion', 'wedding', 'family', 'product', 'food', 'event', 'cosplay'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.portfolio_images'::regclass
      AND conname = 'portfolio_images_content_sha256_check') THEN
    ALTER TABLE public.portfolio_images ADD CONSTRAINT portfolio_images_content_sha256_check
      CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$');
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS portfolio_images_label_queue_idx
  ON public.portfolio_images (label_status, suggested_genre, created_at);

ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.portfolio_images.suggested_genre IS
  'Weak intake hint from a crawl job, not a reviewed image tag.';
COMMENT ON COLUMN public.portfolio_images.label_status IS
  'Manual annotation workflow; the crawler never marks an image reviewed.';
COMMENT ON COLUMN public.portfolio_images.import_metadata IS
  'Non-secret intake context. Never store cookies, keys, or contact data.';
COMMENT ON COLUMN public.photographers.dataset_key IS
  'Stable importer-owned demo identity. Null for ordinary photographer profiles.';
COMMENT ON COLUMN public.tags.is_active IS
  'Allows a labeling UI to retire a tag without removing existing image_tags.';

-- Existing table RLS, grants, enums, ownership and Storage policies are preserved.
-- No new client write permission is granted by this migration.
COMMIT;
