ALTER TABLE public.spines ADD COLUMN IF NOT EXISTS origin_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

WITH origins AS (
  SELECT DISTINCT ON (spine_id) spine_id,id FROM public.orders
  WHERE spine_id IS NOT NULL ORDER BY spine_id,created_at,id
)
UPDATE public.spines s SET origin_order_id=origins.id FROM origins WHERE origins.spine_id=s.id AND s.origin_order_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_spine_origin_on_first_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.spine_id IS NOT NULL THEN UPDATE public.spines SET origin_order_id=NEW.id WHERE id=NEW.spine_id AND origin_order_id IS NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS set_spine_origin_on_first_order ON public.orders;
CREATE TRIGGER set_spine_origin_on_first_order AFTER INSERT OR UPDATE OF spine_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_spine_origin_on_first_order();

CREATE UNIQUE INDEX IF NOT EXISTS orders_spine_project_sort_unique ON public.orders(spine_id,project_sort_order)
WHERE spine_id IS NOT NULL AND project_sort_order IS NOT NULL;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_project_sort_order_positive;
ALTER TABLE public.orders ADD CONSTRAINT orders_project_sort_order_positive CHECK (project_sort_order IS NULL OR project_sort_order>0);

CREATE OR REPLACE FUNCTION public.guard_project_sort_order_write()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.project_sort_order IS DISTINCT FROM OLD.project_sort_order
    AND coalesce(auth.role(),'') <> 'service_role' AND NOT public.is_current_user_platform_admin()
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_project_sort_order_write ON public.orders;
CREATE TRIGGER guard_project_sort_order_write BEFORE UPDATE OF project_sort_order ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_project_sort_order_write();

CREATE OR REPLACE FUNCTION public.reorder_project_spine_legs(p_spine_id UUID,p_order_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_expected UUID[]; v_id UUID; v_position INTEGER:=0;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_spine_id::text,0));
  SELECT array_agg(id ORDER BY id) INTO v_expected FROM public.orders WHERE spine_id=p_spine_id;
  IF coalesce(array_length(v_expected,1),0)<>coalesce(array_length(p_order_ids,1),0)
    OR (SELECT array_agg(x ORDER BY x) FROM unnest(p_order_ids)x) IS DISTINCT FROM v_expected
  THEN RAISE EXCEPTION 'invalid leg set'; END IF;
  UPDATE public.orders SET project_sort_order=project_sort_order+1000000 WHERE spine_id=p_spine_id;
  FOREACH v_id IN ARRAY p_order_ids LOOP v_position:=v_position+1; UPDATE public.orders SET project_sort_order=v_position WHERE id=v_id AND spine_id=p_spine_id; END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.reorder_project_spine_legs(UUID,UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_project_spine_legs(UUID,UUID[]) TO authenticated, service_role;

WITH ranked AS (
  SELECT id,row_number() OVER (PARTITION BY order_id ORDER BY created_at,id)::smallint AS position
  FROM public.order_files
  WHERE category='project' AND file_variant='original' AND is_thumbnail AND thumbnail_sort_order IS NULL
)
UPDATE public.order_files f SET thumbnail_sort_order=ranked.position
FROM ranked WHERE ranked.id=f.id AND ranked.position<=3;
UPDATE public.order_files SET is_thumbnail=false
WHERE category='project' AND file_variant='original' AND is_thumbnail AND thumbnail_sort_order IS NULL;

CREATE OR REPLACE FUNCTION public.guard_project_official_image()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_origin UUID; v_seller UUID; v_is_trader BOOLEAN;
BEGIN
  IF NEW.is_thumbnail IS NOT DISTINCT FROM OLD.is_thumbnail AND NEW.thumbnail_sort_order IS NOT DISTINCT FROM OLD.thumbnail_sort_order THEN RETURN NEW; END IF;
  SELECT s.origin_order_id,o.seller_organisation_id,coalesce(org.is_trader,false) INTO v_origin,v_seller,v_is_trader
  FROM public.orders o JOIN public.spines s ON s.id=o.spine_id LEFT JOIN public.organisations org ON org.id=o.seller_organisation_id WHERE o.id=NEW.order_id;
  IF coalesce(auth.role(),'')<>'service_role' AND NOT public.is_current_user_platform_admin()
    AND NOT (v_origin=NEW.order_id AND v_is_trader AND public.current_user_in_org(v_seller) AND public.current_user_has_right(v_seller,'action','deal','create'))
  THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NEW.is_thumbnail AND (v_origin IS DISTINCT FROM NEW.order_id OR NEW.category<>'project' OR NEW.file_variant<>'original'
    OR NEW.lifecycle_status<>'ready' OR NEW.mime_type NOT LIKE 'image/%' OR NEW.thumbnail_sort_order IS NULL)
  THEN RAISE EXCEPTION 'invalid official image'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_project_official_image ON public.order_files;
CREATE TRIGGER guard_project_official_image BEFORE UPDATE OF is_thumbnail,thumbnail_sort_order ON public.order_files
FOR EACH ROW EXECUTE FUNCTION public.guard_project_official_image();

DROP POLICY IF EXISTS order_files_spine_thumbnail_select ON public.order_files;
CREATE POLICY order_files_spine_thumbnail_select ON public.order_files FOR SELECT TO authenticated USING (
  is_thumbnail AND EXISTS(SELECT 1 FROM public.spines s JOIN public.orders visible ON visible.spine_id=s.id
    WHERE s.origin_order_id=order_files.order_id AND public.can_access_order(visible.id))
);
DROP POLICY IF EXISTS order_storage_spine_thumbnail_select ON storage.objects;
CREATE POLICY order_storage_spine_thumbnail_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='orders' AND EXISTS(SELECT 1 FROM public.order_files f JOIN public.spines s ON s.origin_order_id=f.order_id
    JOIN public.orders visible ON visible.spine_id=s.id WHERE f.storage_path=storage.objects.name AND f.is_thumbnail AND public.can_access_order(visible.id))
);

NOTIFY pgrst,'reload schema';
