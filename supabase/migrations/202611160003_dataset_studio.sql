-- Local dataset curator. Run after the two demo intake/catalog migrations.
-- No media, tags, Auth identities, or existing application policies are deleted.
BEGIN;

ALTER TABLE public.portfolios ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.photographers ADD COLUMN IF NOT EXISTS dataset_sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS portfolios_dataset_order_idx
  ON public.portfolios (photographer_id, sort_order, created_at);

CREATE OR REPLACE FUNCTION public.dataset_studio_apply(p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
  v_owner uuid;
  v_target uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_tags uuid[] := '{}'::uuid[];
  v_count integer;
  v_base integer;
  v_category text;
  v_kind public.tag_kind;
  v_request text;
BEGIN
  IF p_action = 'ping' THEN RETURN jsonb_build_object('version', 1); END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Expected an object payload' USING ERRCODE = '22023';
  END IF;
  -- Serialize curator writes; each multi-image operation commits atomically.
  PERFORM pg_advisory_xact_lock(hashtextextended('frameroom-dataset-studio', 0));

  IF p_payload ? 'id' THEN v_id := (p_payload->>'id')::uuid; END IF;
  IF p_payload ? 'ids' THEN
    SELECT coalesce(array_agg(DISTINCT value::uuid), '{}'::uuid[]) INTO v_ids
      FROM jsonb_array_elements_text(p_payload->'ids');
    IF cardinality(v_ids) <> jsonb_array_length(p_payload->'ids') THEN
      RAISE EXCEPTION 'Duplicate IDs' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_payload ? 'tag_ids' THEN
    SELECT coalesce(array_agg(DISTINCT value::uuid), '{}'::uuid[]) INTO v_tags
      FROM jsonb_array_elements_text(p_payload->'tag_ids');
  END IF;

  IF p_action LIKE 'photographer.%' AND p_action <> 'photographer.order' THEN
    IF NOT EXISTS (SELECT 1 FROM public.photographers WHERE id = v_id AND dataset_key IS NOT NULL) THEN
      RAISE EXCEPTION 'Photographer is outside the demo dataset' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_action IN ('album.save', 'album.archive', 'album.order') THEN
    IF p_action = 'album.save' AND v_id IS NULL THEN
      v_owner := (p_payload->>'photographer_id')::uuid;
    ELSIF p_action = 'album.order' THEN
      v_owner := (p_payload->>'photographer_id')::uuid;
    ELSE
      SELECT photographer_id INTO v_owner FROM public.portfolios WHERE id = v_id AND owner_type::text = 'photographer';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.photographers WHERE id = v_owner AND dataset_key IS NOT NULL) THEN
      RAISE EXCEPTION 'Album is outside the demo dataset' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_action = 'image.save' THEN v_ids := ARRAY[v_id]; END IF;
  IF p_action IN ('image.save', 'images.move', 'images.order', 'images.archive', 'images.review', 'images.tags') THEN
    IF cardinality(v_ids) < 1 OR cardinality(v_ids) > 500 THEN
      RAISE EXCEPTION 'Select 1 to 500 images' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_count FROM public.portfolio_images i
      JOIN public.portfolios p ON p.id = i.portfolio_id
      JOIN public.photographers ph ON ph.id = p.photographer_id
      WHERE i.id = ANY(v_ids) AND ph.dataset_key IS NOT NULL;
    IF v_count <> cardinality(v_ids) THEN
      RAISE EXCEPTION 'Image is outside the demo dataset' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_action = 'photographer.save' THEN
    IF length(trim(p_payload->>'display_name')) NOT BETWEEN 1 AND 60 OR length(coalesce(p_payload->>'bio', '')) > 4000 THEN
      RAISE EXCEPTION 'Invalid photographer fields' USING ERRCODE = '22023';
    END IF;
    UPDATE public.photographers SET display_name = trim(p_payload->>'display_name'),
      bio = coalesce(p_payload->>'bio', ''), city = coalesce(p_payload->>'city', ''), updated_at = now()
      WHERE id = v_id;
  ELSIF p_action = 'photographer.archive' THEN
    UPDATE public.photographers SET is_hidden = coalesce((p_payload->>'archived')::boolean, true), updated_at = now() WHERE id = v_id;
  ELSIF p_action = 'photographer.order' THEN
    SELECT count(*) INTO v_count FROM public.photographers WHERE id = ANY(v_ids) AND dataset_key IS NOT NULL;
    IF v_count <> cardinality(v_ids) OR v_count = 0 THEN
      RAISE EXCEPTION 'Invalid demo photographer order' USING ERRCODE = '22023';
    END IF;
    UPDATE public.photographers ph SET dataset_sort_order = x.ordinality::integer - 1, updated_at = now()
      FROM jsonb_array_elements_text(p_payload->'ids') WITH ORDINALITY x(value, ordinality) WHERE ph.id = x.value::uuid;
  ELSIF p_action = 'album.save' THEN
    IF length(trim(p_payload->>'title')) NOT BETWEEN 1 AND 150 OR length(coalesce(p_payload->>'description', '')) > 10000
      OR coalesce(p_payload->>'status', '') NOT IN ('draft', 'published', 'hidden') THEN
      RAISE EXCEPTION 'Invalid album fields' USING ERRCODE = '22023';
    END IF;
    IF v_id IS NULL THEN
      v_request := p_payload->>'request_id';
      IF v_request IS NULL OR v_request !~ '^[a-f0-9-]{36}$' THEN
        RAISE EXCEPTION 'A creation request ID is required' USING ERRCODE = '22023';
      END IF;
      SELECT id INTO v_id FROM public.portfolios WHERE dataset_key = 'curated:' || v_request AND photographer_id = v_owner;
      IF v_id IS NOT NULL THEN RETURN jsonb_build_object('id', v_id); END IF;
      SELECT coalesce(max(sort_order), -1) + 1 INTO v_base FROM public.portfolios WHERE photographer_id = v_owner;
      INSERT INTO public.portfolios (owner_type, photographer_id, title, description, genre, status, published_at, dataset_key, sort_order)
        VALUES ('photographer', v_owner, trim(p_payload->>'title'), coalesce(p_payload->>'description', ''),
          (p_payload->>'genre')::public.genre, (p_payload->>'status')::public.portfolio_status,
          CASE WHEN p_payload->>'status' = 'published' THEN now() END, 'curated:' || v_request, v_base)
        RETURNING id INTO v_id;
    ELSE
      UPDATE public.portfolios SET title = trim(p_payload->>'title'), description = coalesce(p_payload->>'description', ''),
        genre = (p_payload->>'genre')::public.genre, status = (p_payload->>'status')::public.portfolio_status,
        published_at = CASE WHEN p_payload->>'status' = 'published' THEN coalesce(published_at, now()) ELSE published_at END,
        updated_at = now() WHERE id = v_id;
    END IF;
  ELSIF p_action = 'album.archive' THEN
    UPDATE public.portfolios SET deleted_at = CASE WHEN coalesce((p_payload->>'archived')::boolean, true) THEN now() END,
      status = CASE WHEN coalesce((p_payload->>'archived')::boolean, true) THEN 'hidden' ELSE 'draft' END::public.portfolio_status,
      updated_at = now() WHERE id = v_id;
  ELSIF p_action = 'album.order' THEN
    SELECT count(*) INTO v_count FROM public.portfolios WHERE id = ANY(v_ids) AND photographer_id = v_owner AND deleted_at IS NULL;
    IF v_count <> cardinality(v_ids) OR v_count = 0 THEN
      RAISE EXCEPTION 'Invalid album order' USING ERRCODE = '22023';
    END IF;
    UPDATE public.portfolios p SET sort_order = x.ordinality::integer - 1, updated_at = now()
      FROM jsonb_array_elements_text(p_payload->'ids') WITH ORDINALITY x(value, ordinality) WHERE p.id = x.value::uuid;
  ELSIF p_action = 'images.move' THEN
    v_target := (p_payload->>'portfolio_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.portfolios p JOIN public.photographers ph ON ph.id = p.photographer_id
      WHERE p.id = v_target AND p.deleted_at IS NULL AND ph.dataset_key IS NOT NULL AND NOT ph.is_hidden) THEN
      RAISE EXCEPTION 'Invalid destination album' USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(max(sort_order), -1) + 1 INTO v_base FROM public.portfolio_images WHERE portfolio_id = v_target;
    UPDATE public.portfolio_images i SET portfolio_id = v_target, sort_order = v_base + x.ordinality::integer - 1, updated_at = now()
      FROM jsonb_array_elements_text(p_payload->'ids') WITH ORDINALITY x(value, ordinality) WHERE i.id = x.value::uuid;
  ELSIF p_action = 'images.order' THEN
    v_target := (p_payload->>'portfolio_id')::uuid;
    IF EXISTS (SELECT 1 FROM public.portfolio_images WHERE id = ANY(v_ids) AND portfolio_id <> v_target) THEN
      RAISE EXCEPTION 'Order must stay within one album' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM public.portfolio_images WHERE portfolio_id = v_target AND NOT is_hidden) <> cardinality(v_ids)
      OR EXISTS (SELECT 1 FROM public.portfolio_images WHERE id = ANY(v_ids) AND is_hidden) THEN
      RAISE EXCEPTION 'Reorder the complete active album' USING ERRCODE = '22023';
    END IF;
    UPDATE public.portfolio_images i SET sort_order = x.ordinality::integer - 1, updated_at = now()
      FROM jsonb_array_elements_text(p_payload->'ids') WITH ORDINALITY x(value, ordinality) WHERE i.id = x.value::uuid;
  ELSIF p_action = 'images.archive' THEN
    UPDATE public.portfolio_images SET is_hidden = coalesce((p_payload->>'archived')::boolean, true), updated_at = now() WHERE id = ANY(v_ids);
  ELSIF p_action = 'images.review' THEN
    IF coalesce(p_payload->>'label_status', '') NOT IN ('unlabeled', 'suggested', 'reviewed') THEN
      RAISE EXCEPTION 'Invalid annotation state' USING ERRCODE = '22023';
    END IF;
    UPDATE public.portfolio_images SET label_status = p_payload->>'label_status', updated_at = now() WHERE id = ANY(v_ids);
  ELSIF p_action = 'image.save' THEN
    IF length(coalesce(p_payload->>'caption', '')) > 4000 OR coalesce(p_payload->>'label_status', '') NOT IN ('unlabeled', 'suggested', 'reviewed') THEN
      RAISE EXCEPTION 'Invalid image fields' USING ERRCODE = '22023';
    END IF;
    UPDATE public.portfolio_images SET caption = coalesce(p_payload->>'caption', ''),
      label_status = p_payload->>'label_status', updated_at = now() WHERE id = v_id;
  ELSIF p_action NOT IN ('images.tags', 'tag.save', 'tag.archive') THEN
    RAISE EXCEPTION 'Unknown curator action' USING ERRCODE = '22023';
  END IF;

  IF p_action IN ('images.tags', 'image.save') THEN
    IF p_action = 'images.tags' AND coalesce(p_payload->>'mode', '') NOT IN ('add', 'remove', 'replace') THEN
      RAISE EXCEPTION 'Invalid tag operation' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_count FROM public.tags WHERE id = ANY(v_tags);
    IF v_count <> cardinality(v_tags) THEN RAISE EXCEPTION 'Unknown tag' USING ERRCODE = '22023'; END IF;
    IF p_action = 'image.save' OR p_payload->>'mode' = 'replace' THEN
      DELETE FROM public.image_tags WHERE portfolio_image_id = ANY(v_ids);
    ELSIF p_payload->>'mode' = 'remove' THEN
      DELETE FROM public.image_tags WHERE portfolio_image_id = ANY(v_ids) AND tag_id = ANY(v_tags);
    END IF;
    IF p_action = 'image.save' OR p_payload->>'mode' IN ('add', 'replace') THEN
      INSERT INTO public.image_tags (portfolio_image_id, tag_id, source, confidence)
        SELECT i, t, 'manual', 1 FROM unnest(v_ids) i CROSS JOIN unnest(v_tags) t
        ON CONFLICT (portfolio_image_id, tag_id) DO UPDATE SET source = 'manual', confidence = 1;
    END IF;
  END IF;

  IF p_action = 'tag.save' THEN
    v_category := p_payload->>'category';
    IF v_category NOT IN ('genre','subject','setting','lighting','color_tone','mood','composition','style','editing','styling','source')
      OR coalesce(p_payload->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      OR length(trim(coalesce(p_payload->>'name', ''))) NOT BETWEEN 1 AND 100
      OR length(trim(coalesce(p_payload->>'name_vi', ''))) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'Invalid tag fields' USING ERRCODE = '22023';
    END IF;
    v_kind := CASE WHEN v_category IN ('lighting','color_tone','editing') THEN 'tone'
      WHEN v_category IN ('genre','subject','setting','composition') THEN 'setting' ELSE 'mood' END::public.tag_kind;
    IF v_id IS NULL THEN
      INSERT INTO public.tags (slug,name,name_vi,category,kind,definition_en,definition_vi,aliases)
        VALUES (p_payload->>'slug',trim(p_payload->>'name'),trim(p_payload->>'name_vi'),v_category,v_kind,
          p_payload->>'definition_en',p_payload->>'definition_vi',
          ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'aliases','[]'::jsonb)))) RETURNING id INTO v_id;
    ELSE
      UPDATE public.tags SET slug=p_payload->>'slug',name=trim(p_payload->>'name'),name_vi=trim(p_payload->>'name_vi'),
        category=v_category,kind=v_kind,definition_en=p_payload->>'definition_en',definition_vi=p_payload->>'definition_vi',
        aliases=ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'aliases','[]'::jsonb))) WHERE id=v_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Unknown tag' USING ERRCODE='22023'; END IF;
    END IF;
  ELSIF p_action = 'tag.archive' THEN
    UPDATE public.tags SET is_active = NOT coalesce((p_payload->>'archived')::boolean, true) WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown tag' USING ERRCODE='22023'; END IF;
  END IF;
  RETURN jsonb_build_object('id',v_id,'ok',true);
END;
$$;

REVOKE ALL ON FUNCTION public.dataset_studio_apply(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dataset_studio_apply(text,jsonb) TO service_role;
COMMENT ON FUNCTION public.dataset_studio_apply(text,jsonb) IS
  'Local-only curator backend. Service-role execution only; image/album/profile writes are limited to dataset-marked photographers. Deletes are reversible archival.';
NOTIFY pgrst, 'reload schema';
COMMIT;
