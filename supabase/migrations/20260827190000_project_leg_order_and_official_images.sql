ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS project_sort_order INTEGER;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY spine_id ORDER BY created_at, id)::integer AS position
  FROM public.orders WHERE spine_id IS NOT NULL
)
UPDATE public.orders o SET project_sort_order=ranked.position FROM ranked WHERE ranked.id=o.id AND o.project_sort_order IS NULL;

ALTER TABLE public.order_files ADD COLUMN IF NOT EXISTS thumbnail_sort_order SMALLINT;
ALTER TABLE public.order_files DROP CONSTRAINT IF EXISTS order_files_thumbnail_sort_order_check;
ALTER TABLE public.order_files ADD CONSTRAINT order_files_thumbnail_sort_order_check
  CHECK (thumbnail_sort_order IS NULL OR thumbnail_sort_order BETWEEN 1 AND 3);
CREATE UNIQUE INDEX IF NOT EXISTS order_files_official_image_position_unique
  ON public.order_files(order_id, thumbnail_sort_order) WHERE is_thumbnail AND thumbnail_sort_order IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reorder_project_spine_legs(p_spine_id UUID, p_order_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_expected UUID[]; v_id UUID; v_position INTEGER := 0;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT array_agg(id ORDER BY id) INTO v_expected FROM public.orders WHERE spine_id=p_spine_id;
  IF coalesce(array_length(v_expected,1),0) <> coalesce(array_length(p_order_ids,1),0)
    OR (SELECT array_agg(x ORDER BY x) FROM unnest(p_order_ids) x) IS DISTINCT FROM v_expected
  THEN RAISE EXCEPTION 'invalid leg set'; END IF;
  FOREACH v_id IN ARRAY p_order_ids LOOP
    v_position := v_position + 1;
    UPDATE public.orders SET project_sort_order=v_position WHERE id=v_id AND spine_id=p_spine_id;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.reorder_project_spine_legs(UUID,UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_project_spine_legs(UUID,UUID[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
