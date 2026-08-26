-- Prototype project-file cleanup and adjacent-leg sharing.
ALTER TABLE public.order_files
  ADD COLUMN IF NOT EXISTS cleanup_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS cleanup_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cleaned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.portal_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_to_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shared_by UUID REFERENCES public.portal_users(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='order_files_cleanup_status_check') THEN
    ALTER TABLE public.order_files ADD CONSTRAINT order_files_cleanup_status_check
      CHECK (cleanup_status IN ('not_started','processing','needs_review','approved','failed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS order_files_one_recipient_copy_per_source
  ON public.order_files(source_file_id)
  WHERE category='project' AND file_variant='recipient_copy' AND source_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_files_shared_destination
  ON public.order_files(shared_to_order_id)
  WHERE shared_to_order_id IS NOT NULL AND cleanup_status='approved';

INSERT INTO public.platform_settings(key, value)
VALUES ('project_file_cleanup', jsonb_build_object(
  'llmEnabled', false,
  'prompt', 'Find names, company names, customer names, project names, email addresses, phone numbers, domains, and other text that could identify the original document owner. Return only a JSON array of exact strings found in the document.',
  'extraTerms', '[]'::jsonb
)) ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS order_files_select ON public.order_files;
CREATE POLICY order_files_select ON public.order_files FOR SELECT TO authenticated USING (
  (
    file_variant='original'
    AND public.can_access_order(order_id)
  )
  OR (
    file_variant='recipient_copy'
    AND (
      public.is_current_user_platform_admin()
      OR EXISTS (
        SELECT 1 FROM public.orders source_order
        WHERE source_order.id=order_id
          AND public.current_user_in_org(source_order.seller_organisation_id)
      )
    )
  )
  OR (
    category='project'
    AND file_variant='recipient_copy'
    AND cleanup_status='approved'
    AND shared_to_order_id IS NOT NULL
    AND public.can_access_order(shared_to_order_id)
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
          WHERE f.storage_path=p_name AND f.category='project' AND f.file_variant='recipient_copy'
            AND f.cleanup_status='approved' AND f.shared_to_order_id IS NOT NULL
            AND public.can_access_order(f.shared_to_order_id)
        )
      ELSE public.can_access_order((split_part(p_name,'/',1))::uuid) END
    ELSE public.is_current_user_platform_admin()
  END
$$;

CREATE OR REPLACE FUNCTION public.queue_project_clean_copy_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.category='project' THEN
    INSERT INTO public.project_storage_cleanup(order_id, storage_path)
    VALUES (OLD.order_id, OLD.storage_path)
    ON CONFLICT (order_id, storage_path) DO UPDATE SET not_before=LEAST(project_storage_cleanup.not_before, now());
    IF OLD.file_variant='original' THEN
      DELETE FROM public.order_files WHERE source_file_id=OLD.id AND file_variant='recipient_copy';
    END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS project_clean_copy_delete_queue ON public.order_files;
CREATE TRIGGER project_clean_copy_delete_queue BEFORE DELETE ON public.order_files
FOR EACH ROW EXECUTE FUNCTION public.queue_project_clean_copy_delete();

NOTIFY pgrst, 'reload schema';
