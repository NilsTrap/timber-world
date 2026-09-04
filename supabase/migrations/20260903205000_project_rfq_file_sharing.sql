-- A project file may be prepared for an RFQ before any downstream order exists.
-- Invited candidates can read approved shared copies; an award binds them to the
-- newly created order so the winner keeps access from the awarded leg.
ALTER TABLE public.order_files
  ADD COLUMN IF NOT EXISTS shared_with_rfq_candidates BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_order_files_rfq_shared
  ON public.order_files(order_id)
  WHERE category = 'project'
    AND cleanup_status = 'approved'
    AND shared_with_rfq_candidates;

CREATE OR REPLACE FUNCTION public.can_access_rfq_shared_project_file(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_rfqs r
    JOIN public.project_rfq_candidates c ON c.rfq_id = r.id
    JOIN public.orders rfq_order ON rfq_order.id = r.order_id
    WHERE (rfq_order.id = p_order_id OR rfq_order.upstream_deal_id = p_order_id)
      AND r.status = 'open'
      AND r.deadline > now()
      AND c.status IN ('invited', 'submitted')
      AND public.current_user_in_org(c.organization_id)
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_rfq_shared_project_file(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_rfq_shared_project_file(UUID) TO authenticated;

DROP POLICY IF EXISTS order_files_select ON public.order_files;
CREATE POLICY order_files_select ON public.order_files FOR SELECT TO authenticated USING (
  (file_variant = 'original' AND public.can_access_order(order_id))
  OR (
    file_variant = 'recipient_copy'
    AND (
      public.is_current_user_platform_admin()
      OR EXISTS (
        SELECT 1 FROM public.orders source_order
        WHERE source_order.id = order_id
          AND public.current_user_in_org(source_order.seller_organisation_id)
      )
    )
  )
  OR (
    category = 'project'
    AND cleanup_status = 'approved'
    AND shared_to_order_id IS NOT NULL
    AND public.can_access_order(shared_to_order_id)
  )
  OR (
    category = 'project'
    AND cleanup_status = 'approved'
    AND shared_with_rfq_candidates
    AND public.can_access_rfq_shared_project_file(order_id)
  )
);

CREATE OR REPLACE FUNCTION public.order_path_accessible(p_name TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN split_part(p_name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN CASE WHEN EXISTS (
        SELECT 1 FROM public.order_files recipient
        WHERE recipient.storage_path=p_name AND recipient.category='project' AND recipient.file_variant='recipient_copy'
      ) THEN public.is_current_user_platform_admin()
        OR EXISTS (
          SELECT 1 FROM public.order_files recipient
          JOIN public.orders source_order ON source_order.id=recipient.order_id
          WHERE recipient.storage_path=p_name AND recipient.category='project' AND recipient.file_variant='recipient_copy'
            AND public.current_user_in_org(source_order.seller_organisation_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.order_files f
          WHERE f.storage_path=p_name AND f.category='project'
            AND f.cleanup_status='approved' AND f.shared_to_order_id IS NOT NULL
            AND public.can_access_order(f.shared_to_order_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.order_files f
          WHERE f.storage_path=p_name AND f.category='project'
            AND f.cleanup_status='approved' AND f.shared_with_rfq_candidates
            AND public.can_access_rfq_shared_project_file(f.order_id)
        )
      ELSE public.can_access_order((split_part(p_name,'/',1))::uuid) END
    ELSE public.is_current_user_platform_admin()
  END
$$;

CREATE OR REPLACE FUNCTION public.bind_rfq_shared_files_to_awarded_leg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.upstream_deal_id IS NOT NULL
     AND NEW.upstream_deal_id IS DISTINCT FROM OLD.upstream_deal_id THEN
    UPDATE public.order_files
       SET shared_to_order_id = NEW.upstream_deal_id
     WHERE order_id = NEW.id
       AND category = 'project'
       AND cleanup_status = 'approved'
       AND shared_with_rfq_candidates;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS bind_rfq_shared_files_after_award ON public.orders;
CREATE TRIGGER bind_rfq_shared_files_after_award
AFTER UPDATE OF upstream_deal_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.bind_rfq_shared_files_to_awarded_leg();

NOTIFY pgrst, 'reload schema';
