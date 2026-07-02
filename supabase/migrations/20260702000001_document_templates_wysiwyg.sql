-- E6.1 · WYSIWYG editor — additive columns on document_templates.
--
-- TipTap JSON (doc_json) is the editable SOURCE OF TRUTH for wysiwyg templates;
-- a pure compiler emits Handlebars into the EXISTING html column on save, so the
-- render pipeline (templateMerge.ts + gotenberg.ts, which read ONLY html) stays
-- 100% unchanged. content_format selects which editor surface opens ('wysiwyg'
-- visual vs 'html' raw code). page_settings holds A4 margin / footer / logo URL;
-- logo_path is the storage object path for replace/cleanup.
--
-- Purely ADDITIVE + IDEMPOTENT (ADD COLUMN IF NOT EXISTS, guarded CHECK). NO
-- backfill: the 7 seeded rows keep content_format='html', doc_json NULL, and
-- html byte-identical, so document generation is completely unaffected.

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS doc_json jsonb;

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS content_format text NOT NULL DEFAULT 'html';

-- Guarded CHECK so a re-run never errors on the already-present constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_templates_content_format_chk'
  ) THEN
    ALTER TABLE public.document_templates
      ADD CONSTRAINT document_templates_content_format_chk
      CHECK (content_format IN ('html', 'wysiwyg'));
  END IF;
END $$;

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS page_settings jsonb;

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS logo_path text;
