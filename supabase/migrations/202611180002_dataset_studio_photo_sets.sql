-- Keep unassigned photo sets in the curator until they become photographer portfolios.
BEGIN;

CREATE TABLE public.dataset_studio_sets (
  id uuid PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  request_id uuid NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 150),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 10000),
  genre public.genre NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.dataset_studio_set_images (
  image_id uuid PRIMARY KEY REFERENCES public.portfolio_images(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.dataset_studio_sets(id) ON DELETE CASCADE,
  sort_order integer NOT NULL
);
CREATE INDEX dataset_studio_set_images_set_id_idx ON public.dataset_studio_set_images (set_id);

ALTER TABLE public.dataset_studio_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_studio_set_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dataset_studio_sets, public.dataset_studio_set_images FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_studio_sets, public.dataset_studio_set_images TO service_role;

CREATE OR REPLACE FUNCTION public.dataset_studio_sets_apply(p_action text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_set public.dataset_studio_sets%ROWTYPE;
  v_album public.portfolios%ROWTYPE;
  v_id uuid;
  v_request uuid;
  v_ids uuid[];
  v_owner uuid;
  v_count integer;
  v_base integer;
  v_result jsonb;
BEGIN
  IF p_action = 'ping' THEN RETURN jsonb_build_object('version', 1); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('frameroom-dataset-studio', 0));
  v_id := coalesce(p_payload->>'id', p_payload->>'portfolio_id')::uuid;
  SELECT * INTO v_set FROM public.dataset_studio_sets WHERE id = v_id FOR UPDATE;

  IF p_action = 'set.save' THEN
    IF v_id IS NOT NULL THEN
      IF v_set.id IS NULL OR v_set.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Unassigned set is unavailable' USING ERRCODE = '22023';
      END IF;
      UPDATE public.dataset_studio_sets SET title = trim(p_payload->>'title'),
        description = coalesce(p_payload->>'description', ''), genre = (p_payload->>'genre')::public.genre
        WHERE id = v_id;
    ELSE
      v_request := (p_payload->>'request_id')::uuid;
      SELECT id INTO v_id FROM public.dataset_studio_sets WHERE request_id = v_request;
      IF NOT FOUND THEN
        SELECT id INTO v_id FROM public.portfolios WHERE dataset_key = 'dataset-set:' || v_request::text;
      END IF;
      IF v_id IS NULL THEN
        INSERT INTO public.dataset_studio_sets (request_id, title, description, genre)
          VALUES (v_request, trim(p_payload->>'title'), coalesce(p_payload->>'description', ''),
            (p_payload->>'genre')::public.genre)
          RETURNING id INTO v_id;
        IF p_payload ? 'ids' THEN
          PERFORM public.dataset_studio_sets_apply('images.move',
            jsonb_build_object('portfolio_id', v_id, 'ids', p_payload->'ids'));
        END IF;
      END IF;
    END IF;
  ELSIF p_action = 'album.archive' THEN
    IF v_set.id IS NULL THEN
      RETURN public.dataset_studio_apply(p_action, p_payload);
    END IF;
    UPDATE public.dataset_studio_sets
      SET deleted_at = CASE WHEN coalesce((p_payload->>'archived')::boolean, true) THEN now() END
      WHERE id = v_id;
  ELSIF p_action = 'set.assign' THEN
    v_owner := (p_payload->>'photographer_id')::uuid;
    PERFORM 1 FROM public.photographers
      WHERE id = v_owner AND dataset_key IS NOT NULL AND NOT is_hidden FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid photographer destination' USING ERRCODE = '42501';
    END IF;
    SELECT coalesce(max(sort_order), -1) + 1 INTO v_base
      FROM public.portfolios WHERE photographer_id = v_owner;
    IF v_set.id IS NOT NULL AND v_set.deleted_at IS NULL THEN
      -- Every image must still belong to the demo dataset when the set is assigned.
      SELECT count(*) INTO v_count FROM (
        SELECT i.id FROM public.dataset_studio_set_images m
        JOIN public.portfolio_images i ON i.id = m.image_id
        JOIN public.portfolios p ON p.id = i.portfolio_id
        JOIN public.photographers ph ON ph.id = p.photographer_id
        WHERE m.set_id = v_id AND p.owner_type::text = 'photographer' AND ph.dataset_key IS NOT NULL
        FOR UPDATE OF i FOR SHARE OF p, ph
      ) AS scoped_images;
      IF v_count = 0 OR v_count <> (SELECT count(*) FROM public.dataset_studio_set_images WHERE set_id = v_id) THEN
        RAISE EXCEPTION 'Set is empty or contains out-of-scope images' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.portfolios (id, owner_type, photographer_id, title, description, genre, status, dataset_key, sort_order)
        VALUES (v_id, 'photographer', v_owner, v_set.title, v_set.description, v_set.genre, 'draft',
          'dataset-set:' || v_set.request_id::text, v_base);
      UPDATE public.portfolio_images i SET portfolio_id = v_id, sort_order = m.sort_order, updated_at = now()
        FROM public.dataset_studio_set_images m WHERE m.set_id = v_id AND i.id = m.image_id;
      DELETE FROM public.dataset_studio_sets WHERE id = v_id;
    ELSE
      SELECT p.* INTO v_album FROM public.portfolios p JOIN public.photographers ph ON ph.id = p.photographer_id
        WHERE p.id = v_id AND p.owner_type::text = 'photographer' AND ph.dataset_key IS NOT NULL
          AND p.deleted_at IS NULL AND coalesce(p.dataset_key, '') !~ ':inbox(:rev:[0-9]+)?$'
        FOR UPDATE OF p FOR SHARE OF ph;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Set is unavailable for assignment' USING ERRCODE = '42501';
      END IF;
      IF v_album.photographer_id <> v_owner THEN
        UPDATE public.portfolios SET photographer_id = v_owner, sort_order = v_base, updated_at = now()
          WHERE id = v_id;
      END IF;
    END IF;
  ELSIF p_action IN ('images.move', 'images.order') THEN
    SELECT array_agg(value::uuid ORDER BY ordinality) INTO v_ids
      FROM jsonb_array_elements_text(p_payload->'ids') WITH ORDINALITY selected(value, ordinality);
    IF coalesce(cardinality(v_ids), 0) NOT BETWEEN 1 AND 500 OR
      (SELECT count(DISTINCT id) FROM unnest(v_ids) AS selected(id)) <> cardinality(v_ids) THEN
      RAISE EXCEPTION 'Select 1 to 500 distinct images' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_count FROM (
      SELECT i.id FROM public.portfolio_images i
      JOIN public.portfolios p ON p.id = i.portfolio_id
      JOIN public.photographers ph ON ph.id = p.photographer_id
      LEFT JOIN public.dataset_studio_set_images m ON m.image_id = i.id
      WHERE i.id = ANY(v_ids) AND p.owner_type::text = 'photographer' AND ph.dataset_key IS NOT NULL
        AND (p_action = 'images.move' OR (NOT i.is_hidden AND coalesce(m.set_id, i.portfolio_id) = v_id))
      FOR UPDATE OF i FOR SHARE OF p, ph
    ) AS scoped_images;
    IF v_count <> cardinality(v_ids) THEN
      RAISE EXCEPTION 'Invalid image selection' USING ERRCODE = '42501';
    END IF;
    IF v_set.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Set is archived' USING ERRCODE = '22023';
    END IF;
    IF p_action = 'images.move' THEN
      IF v_set.id IS NULL THEN
        v_result := public.dataset_studio_apply(p_action, p_payload);
        DELETE FROM public.dataset_studio_set_images WHERE image_id = ANY(v_ids);
        RETURN v_result;
      END IF;
      SELECT coalesce(max(sort_order), -1) + 1 INTO v_base
        FROM public.dataset_studio_set_images WHERE set_id = v_id;
      INSERT INTO public.dataset_studio_set_images (image_id, set_id, sort_order)
        SELECT id, v_id, v_base + ordinality::integer - 1
        FROM unnest(v_ids) WITH ORDINALITY AS selected(id, ordinality)
        ON CONFLICT (image_id) DO UPDATE SET set_id = EXCLUDED.set_id, sort_order = EXCLUDED.sort_order
          WHERE dataset_studio_set_images.set_id <> EXCLUDED.set_id;
    ELSE
      IF v_set.id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.portfolios WHERE id = v_id AND deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Set is unavailable for ordering' USING ERRCODE = '22023';
      END IF;
      IF v_set.id IS NULL THEN
        SELECT count(*) INTO v_count FROM public.portfolio_images i
          WHERE i.portfolio_id = v_id AND NOT i.is_hidden
            AND NOT EXISTS (SELECT 1 FROM public.dataset_studio_set_images m WHERE m.image_id = i.id);
      ELSE
        SELECT count(*) INTO v_count FROM public.dataset_studio_set_images m
          JOIN public.portfolio_images i ON i.id = m.image_id
          WHERE m.set_id = v_id AND NOT i.is_hidden;
      END IF;
      IF v_count <> cardinality(v_ids) THEN
        RAISE EXCEPTION 'Reorder the complete active set' USING ERRCODE = '22023';
      END IF;
      IF v_set.id IS NULL THEN
        UPDATE public.portfolio_images i SET sort_order = x.ordinality::integer - 1, updated_at = now()
          FROM unnest(v_ids) WITH ORDINALITY x(id, ordinality) WHERE i.id = x.id;
      ELSE
        UPDATE public.dataset_studio_set_images m SET sort_order = x.ordinality::integer - 1
          FROM unnest(v_ids) WITH ORDINALITY x(id, ordinality) WHERE m.image_id = x.id;
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown set action' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.dataset_studio_sets_apply(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dataset_studio_sets_apply(text,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
