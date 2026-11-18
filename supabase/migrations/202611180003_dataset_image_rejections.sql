-- Keep fingerprints for permanently deleted demo photos and guard future crawl imports.
BEGIN;

CREATE TABLE public.dataset_image_rejections (
  fingerprint text PRIMARY KEY CHECK (fingerprint ~ '^(pixel|sha256):[a-f0-9]{64}$'),
  reason text NOT NULL DEFAULT 'deleted' CHECK (reason IN ('deleted', 'legacy_orphan'))
);
ALTER TABLE public.dataset_image_rejections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dataset_image_rejections FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.dataset_image_rejections TO service_role;

-- Older deletes left the intake object behind. Quarantine matching objects with
-- no image row because they can also be the result of an interrupted import.
INSERT INTO public.dataset_image_rejections (fingerprint, reason)
SELECT DISTINCT 'sha256:' || left(split_part(o.name, '/', 3), 64), 'legacy_orphan'
FROM storage.objects o
JOIN public.portfolios p ON p.id::text = split_part(o.name, '/', 1)
JOIN public.photographers ph ON ph.id = p.photographer_id
WHERE o.bucket_id = 'portfolio-images'
  AND o.name ~ '^[0-9a-f-]{36}/intake/[a-f0-9]{64}[.]jpg$'
  AND p.owner_type::text = 'photographer' AND ph.dataset_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.portfolio_images i
    WHERE i.storage_path = o.name OR i.content_sha256 = left(split_part(o.name, '/', 3), 64)
  );

CREATE OR REPLACE FUNCTION public.dataset_image_intake_status(p_keys text[], p_hashes text[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'images', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dataset_key', dataset_key, 'content_sha256', content_sha256))
      FROM public.portfolio_images WHERE dataset_key = ANY(p_keys) OR content_sha256 = ANY(p_hashes)
    ), '[]'::jsonb),
    'rejected', coalesce((
      SELECT jsonb_agg(jsonb_build_object('fingerprint', fingerprint, 'reason', reason))
      FROM public.dataset_image_rejections
      WHERE fingerprint IN (SELECT 'pixel:' || split_part(key, ':', 3) FROM unnest(p_keys) AS keys(key))
        OR fingerprint IN (SELECT 'sha256:' || hash FROM unnest(p_hashes) AS hashes(hash))
    ), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.dataset_image_intake_status(text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dataset_image_intake_status(text[], text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.reject_deleted_dataset_image()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  -- Serialize with the curator's permanent deletion and check again immediately before insertion.
  PERFORM pg_advisory_xact_lock(hashtextextended('frameroom-dataset-studio', 0));
  IF EXISTS (
    SELECT 1 FROM public.dataset_image_rejections WHERE fingerprint IN (
      'pixel:' || split_part(NEW.dataset_key, ':', 3), 'sha256:' || NEW.content_sha256
    )
  ) THEN
    RAISE EXCEPTION 'This dataset image was permanently deleted' USING ERRCODE = 'FD001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_deleted_dataset_image() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deleted_dataset_image() TO service_role;
CREATE TRIGGER reject_deleted_dataset_image
BEFORE INSERT ON public.portfolio_images
FOR EACH ROW WHEN (NEW.dataset_key ~ '^crawl:v1:[a-f0-9]{64}$')
EXECUTE FUNCTION public.reject_deleted_dataset_image();

CREATE OR REPLACE FUNCTION public.dataset_studio_delete_images(p_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_count integer;
BEGIN
  -- The local server uses an empty array to check migration availability.
  IF cardinality(p_ids) = 0 THEN RETURN jsonb_build_object('deleted', 0); END IF;
  IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 500 OR
    (SELECT count(DISTINCT id) FROM unnest(p_ids) AS requested(id)) <> cardinality(p_ids) THEN
    RAISE EXCEPTION 'Select 1 to 500 distinct images' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('frameroom-dataset-studio', 0));
  -- Lock the image and its current owner chain until all deletes commit.
  SELECT count(*) INTO v_count FROM (
    SELECT i.id FROM public.portfolio_images i
    JOIN public.portfolios p ON p.id = i.portfolio_id
    JOIN public.photographers ph ON ph.id = p.photographer_id
    WHERE i.id = ANY(p_ids) AND p.owner_type::text = 'photographer' AND ph.dataset_key IS NOT NULL
    FOR UPDATE OF i FOR SHARE OF p, ph
  ) AS scoped_images;
  IF v_count <> cardinality(p_ids) THEN
    RAISE EXCEPTION 'Image is missing or outside the demo dataset' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.dataset_image_rejections (fingerprint)
    SELECT 'pixel:' || split_part(dataset_key, ':', 3) FROM public.portfolio_images
      WHERE id = ANY(p_ids) AND dataset_key ~ '^crawl:v1:[a-f0-9]{64}$'
    UNION
    SELECT 'sha256:' || content_sha256 FROM public.portfolio_images
      WHERE id = ANY(p_ids) AND content_sha256 ~ '^[a-f0-9]{64}$'
    ON CONFLICT (fingerprint) DO NOTHING;

  DELETE FROM public.image_embeddings WHERE image_id = ANY(p_ids);
  DELETE FROM public.image_tags WHERE portfolio_image_id = ANY(p_ids);
  DELETE FROM public.portfolio_images WHERE id = ANY(p_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> cardinality(p_ids) THEN
    RAISE EXCEPTION 'Not all requested images could be deleted' USING ERRCODE = '40001';
  END IF;
  RETURN jsonb_build_object('deleted', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.dataset_studio_delete_images(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dataset_studio_delete_images(uuid[]) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
