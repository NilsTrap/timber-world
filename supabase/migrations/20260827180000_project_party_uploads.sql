-- Bilateral deal parties may upload their own project files without receiving
-- the broader deal:create capability used for workspace management.
CREATE OR REPLACE FUNCTION public.can_upload_project_files(p_order_id UUID)
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
          (o.seller_organisation_id IS NOT NULL AND public.current_user_in_org(o.seller_organisation_id))
          OR (o.buyer_organisation_id IS NOT NULL AND public.current_user_in_org(o.buyer_organisation_id))
        )
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_upload_project_files(UUID)
  TO authenticated, service_role;

DROP POLICY IF EXISTS order_files_insert ON public.order_files;
CREATE POLICY order_files_insert ON public.order_files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_order(order_id)
    AND (
      category <> 'project'
      OR public.can_write_project_files(order_id)
      OR (
        public.can_upload_project_files(order_id)
        AND file_variant = 'original'
        AND uploaded_by = public.current_portal_user_id()
      )
    )
  );

DROP POLICY IF EXISTS order_files_update ON public.order_files;
CREATE POLICY order_files_update ON public.order_files
  FOR UPDATE TO authenticated
  USING (
    public.can_access_order(order_id)
    AND (
      category <> 'project'
      OR public.can_write_project_files(order_id)
      OR (
        public.can_upload_project_files(order_id)
        AND file_variant = 'original'
        AND uploaded_by = public.current_portal_user_id()
      )
    )
  )
  WITH CHECK (
    public.can_access_order(order_id)
    AND (
      category <> 'project'
      OR public.can_write_project_files(order_id)
      OR (
        public.can_upload_project_files(order_id)
        AND file_variant = 'original'
        AND uploaded_by = public.current_portal_user_id()
      )
    )
  );

DROP POLICY IF EXISTS order_files_delete ON public.order_files;
CREATE POLICY order_files_delete ON public.order_files
  FOR DELETE TO authenticated
  USING (
    public.can_access_order(order_id)
    AND (
      category <> 'project'
      OR public.can_write_project_files(order_id)
      OR (
        public.can_upload_project_files(order_id)
        AND file_variant = 'original'
        AND uploaded_by = public.current_portal_user_id()
        AND lifecycle_status = 'uploading'
      )
    )
  );

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
        OR EXISTS (
          SELECT 1
          FROM public.order_files f
          WHERE f.storage_path = p_name
            AND f.order_id = (split_part(p_name, '/', 1))::uuid
            AND f.category = 'project'
            AND f.file_variant = 'original'
            AND f.uploaded_by = public.current_portal_user_id()
            AND public.can_upload_project_files(f.order_id)
        )
    ELSE public.can_access_order((split_part(p_name, '/', 1))::uuid)
  END
$$;

GRANT EXECUTE ON FUNCTION public.order_path_writable(TEXT)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
