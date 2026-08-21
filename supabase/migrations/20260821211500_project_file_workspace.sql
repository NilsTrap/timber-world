-- Timber Projects: relative-path file workspace (staging rollout).
-- Additive: legacy customer/production/deal files keep their existing shape and
-- policies. Project rows are isolated behind category='project'.

ALTER TABLE public.order_files DROP CONSTRAINT IF EXISTS order_files_category_check;
ALTER TABLE public.order_files
  ADD CONSTRAINT order_files_category_check
  CHECK (category IN ('customer', 'production', 'deal', 'project'));

ALTER TABLE public.order_files
  ADD COLUMN IF NOT EXISTS relative_path TEXT,
  ADD COLUMN IF NOT EXISTS file_variant TEXT NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS source_file_id UUID,
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'ready';

UPDATE public.order_files
SET relative_path = file_name
WHERE relative_path IS NULL;

ALTER TABLE public.order_files
  ALTER COLUMN relative_path SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_files_file_variant_check'
  ) THEN
    ALTER TABLE public.order_files
      ADD CONSTRAINT order_files_file_variant_check
      CHECK (file_variant IN ('original', 'recipient_copy'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_files_lifecycle_status_check'
  ) THEN
    ALTER TABLE public.order_files
      ADD CONSTRAINT order_files_lifecycle_status_check
      CHECK (lifecycle_status IN ('uploading', 'ready', 'failed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_files_source_file_id_fkey'
  ) THEN
    ALTER TABLE public.order_files
      ADD CONSTRAINT order_files_source_file_id_fkey
      FOREIGN KEY (source_file_id) REFERENCES public.order_files(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_files_project_relative_path_check'
  ) THEN
    ALTER TABLE public.order_files
      ADD CONSTRAINT order_files_project_relative_path_check
      CHECK (
        category <> 'project'
        OR (
          relative_path <> ''
          AND relative_path !~ '^/'
          AND relative_path !~ '^[A-Za-z]:/'
          AND relative_path !~ '(^|/)\.{1,2}(/|$)'
          AND relative_path NOT LIKE '%//%'
          AND position(E'\\' in relative_path) = 0
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_files_project_tree
  ON public.order_files(order_id, relative_path)
  WHERE category = 'project';

CREATE UNIQUE INDEX IF NOT EXISTS order_files_project_path_unique
  ON public.order_files(order_id, file_variant, lower(relative_path))
  WHERE category = 'project';

-- A project-file writer must be able to access this exact bilateral deal and
-- hold action/deal/create in the party organisation through which they access
-- it. A right in an unrelated membership grants nothing.
CREATE OR REPLACE FUNCTION public.can_write_project_files(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_current_user_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = p_order_id
        AND public.can_access_deal_row(
          o.seller_organisation_id,
          o.buyer_organisation_id,
          o.producer_organisation_id,
          o.created_by
        )
        AND (
          (o.seller_organisation_id IS NOT NULL
            AND public.current_user_in_org(o.seller_organisation_id)
            AND public.current_user_has_right(
              o.seller_organisation_id, 'action', 'deal', 'create'
            ))
          OR
          (o.buyer_organisation_id IS NOT NULL
            AND public.current_user_in_org(o.buyer_organisation_id)
            AND public.current_user_has_right(
              o.buyer_organisation_id, 'action', 'deal', 'create'
            ))
        )
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_write_project_files(UUID)
  TO authenticated, service_role;

DROP POLICY IF EXISTS order_files_rw ON public.order_files;
DROP POLICY IF EXISTS order_files_select ON public.order_files;
DROP POLICY IF EXISTS order_files_insert ON public.order_files;
DROP POLICY IF EXISTS order_files_update ON public.order_files;
DROP POLICY IF EXISTS order_files_delete ON public.order_files;

CREATE POLICY order_files_select ON public.order_files
  FOR SELECT TO authenticated
  USING (public.can_access_order(order_id));

CREATE POLICY order_files_insert ON public.order_files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_order(order_id)
    AND (category <> 'project' OR public.can_write_project_files(order_id))
  );

CREATE POLICY order_files_update ON public.order_files
  FOR UPDATE TO authenticated
  USING (
    public.can_access_order(order_id)
    AND (category <> 'project' OR public.can_write_project_files(order_id))
  )
  WITH CHECK (
    public.can_access_order(order_id)
    AND (category <> 'project' OR public.can_write_project_files(order_id))
  );

CREATE POLICY order_files_delete ON public.order_files
  FOR DELETE TO authenticated
  USING (
    public.can_access_order(order_id)
    AND (category <> 'project' OR public.can_write_project_files(order_id))
  );

-- One statement keeps a virtual-folder rename atomic across every descendant.
CREATE OR REPLACE FUNCTION public.rename_project_workspace_folder(
  p_order_id UUID,
  p_from TEXT,
  p_to TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.order_files
  SET relative_path = p_to || substring(relative_path FROM char_length(p_from) + 1)
  WHERE order_id = p_order_id
    AND category = 'project'
    AND file_variant = 'original'
    AND left(relative_path, char_length(p_from) + 1) = p_from || '/';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_project_workspace_folder(UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- Storage paths are <order>/<category>/<opaque id>_<safe name>. Preserve the
-- legacy file flow, while project-object writes follow the stronger capability.
CREATE OR REPLACE FUNCTION public.order_path_writable(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.is_current_user_platform_admin()
    WHEN split_part(p_name, '/', 2) = 'project'
      THEN public.can_write_project_files((split_part(p_name, '/', 1))::uuid)
    ELSE public.can_access_order((split_part(p_name, '/', 1))::uuid)
  END
$$;

GRANT EXECUTE ON FUNCTION public.order_path_writable(TEXT)
  TO authenticated, service_role;

DROP POLICY IF EXISTS "Order-walled upload for orders bucket" ON storage.objects;
CREATE POLICY "Order-walled upload for orders bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'orders' AND public.order_path_writable(name));

DROP POLICY IF EXISTS "Order-walled update for orders bucket" ON storage.objects;
CREATE POLICY "Order-walled update for orders bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'orders' AND public.order_path_writable(name))
  WITH CHECK (bucket_id = 'orders' AND public.order_path_writable(name));

DROP POLICY IF EXISTS "Order-walled delete for orders bucket" ON storage.objects;
CREATE POLICY "Order-walled delete for orders bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'orders' AND public.order_path_writable(name));

NOTIFY pgrst, 'reload schema';
