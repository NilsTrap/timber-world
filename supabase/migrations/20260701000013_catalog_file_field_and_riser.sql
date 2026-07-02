-- =============================================
-- E5 · File-upload catalog field type + riser field + catalog-files bucket
-- Migration: 20260701000013_catalog_file_field_and_riser.sql
--
-- Adds 'file' as a catalog field type (images / technical drawings), a place
-- to store the uploaded file per product/variant EAV row, the `riser` global
-- field (stairs), and a PRIVATE storage bucket for the files (signed URLs —
-- drawings may be proprietary). Additive; legacy untouched.
-- =============================================

-- 1. Widen the field_type CHECK to include 'file'
ALTER TABLE public.catalog_fields
  DROP CONSTRAINT IF EXISTS catalog_fields_field_type_check;
ALTER TABLE public.catalog_fields
  ADD CONSTRAINT catalog_fields_field_type_check
  CHECK (field_type IN ('select', 'number', 'text', 'boolean', 'file'));

-- 2. File value columns on both EAV tables (a file field has no option/number;
--    its value is the stored object + display metadata).
ALTER TABLE public.catalog_product_field_values
  ADD COLUMN IF NOT EXISTS value_storage_path   TEXT,
  ADD COLUMN IF NOT EXISTS value_file_name      TEXT,
  ADD COLUMN IF NOT EXISTS value_mime_type      TEXT,
  ADD COLUMN IF NOT EXISTS value_file_size_bytes BIGINT;

ALTER TABLE public.catalog_variant_field_values
  ADD COLUMN IF NOT EXISTS value_storage_path   TEXT,
  ADD COLUMN IF NOT EXISTS value_file_name      TEXT,
  ADD COLUMN IF NOT EXISTS value_mime_type      TEXT,
  ADD COLUMN IF NOT EXISTS value_file_size_bytes BIGINT;

-- 3. The `riser` global field (stairs variant dimension). Not a system
--    dimension_role (pricing keys off width/length/thickness only).
INSERT INTO public.catalog_fields (id, field_key, field_label, field_type, unit, ref_table) VALUES
  ('f0000001-0010-0000-0000-000000000001', 'riser', 'Riser', 'number', 'mm', NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Private catalog-files bucket (drawings/images attached to catalog fields).
--    Distinct from the public `catalog` bucket (product gallery images).
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-files', 'catalog-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "catalog-files authenticated read" ON storage.objects;
CREATE POLICY "catalog-files authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'catalog-files');

DROP POLICY IF EXISTS "catalog-files admin write" ON storage.objects;
CREATE POLICY "catalog-files admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog-files' AND public.is_current_user_platform_admin());

DROP POLICY IF EXISTS "catalog-files admin update" ON storage.objects;
CREATE POLICY "catalog-files admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'catalog-files' AND public.is_current_user_platform_admin());

DROP POLICY IF EXISTS "catalog-files admin delete" ON storage.objects;
CREATE POLICY "catalog-files admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-files' AND public.is_current_user_platform_admin());
