-- E6 · Document templates — global Handlebars sources for document generation.
--
-- The Gotenberg generator (apps/portal .../documents/gotenberg.ts) loads the
-- active DEFAULT template for a doc type, merges it against DocumentData and
-- converts the resulting HTML to PDF. Templates are GLOBAL (not org-scoped) and
-- non-secret, so RLS grants SELECT to any authenticated user; writes are
-- platform-admin only. Editing happens in the portal (documents.view module).
--
-- Additive & idempotent (CREATE TABLE IF NOT EXISTS, ON CONFLICT, IF NOT EXISTS).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type    TEXT NOT NULL CHECK (doc_type IN
                ('sales_spec','purchase_spec','contract','proforma_invoice','invoice','packing_list','cmr')),
  name        TEXT NOT NULL,
  html        TEXT NOT NULL,                 -- the Handlebars template source
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  version     INTEGER NOT NULL DEFAULT 1,
  created_by  UUID REFERENCES public.portal_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most ONE default template per doc type (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_templates_one_default_per_type
  ON public.document_templates (doc_type)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_document_templates_doc_type
  ON public.document_templates (doc_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. updated_at trigger (reuse the generic fn defined in the deals migration)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER trg_document_templates_updated_at BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.deals_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS — global read, platform-admin write.
--    Permissive policies are OR'd: the SELECT policy opens reads to everyone;
--    the FOR ALL policy is the only one covering INSERT/UPDATE/DELETE, so writes
--    require platform admin. The service-role client bypasses RLS entirely.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_templates_select ON public.document_templates;
CREATE POLICY document_templates_select ON public.document_templates
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS document_templates_write ON public.document_templates;
CREATE POLICY document_templates_write ON public.document_templates
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Module registration (sidebar / permission gate for the template manager)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.modules (code, name, description, category, sort_order)
VALUES ('documents.view', 'Document Templates', 'Manage document templates', 'Settings', 1620)
ON CONFLICT (code) DO NOTHING;

-- Org ceiling: enable template management for internal orgs (house staff).
INSERT INTO public.organization_modules (organization_id, module_code, enabled)
SELECT o.id, 'documents.view', true
FROM public.organisations o
WHERE o.is_external = false
ON CONFLICT (organization_id, module_code) DO NOTHING;
