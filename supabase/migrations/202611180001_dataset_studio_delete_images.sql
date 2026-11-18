-- Apply after 202611160003_dataset_studio.sql. This migration deletes no rows by itself.
BEGIN;

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
