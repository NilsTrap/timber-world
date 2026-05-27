-- ============================================================================
-- Fix: Decouple catalog fields from categories
--
-- Fields become a global registry. A join table assigns them to categories
-- with per-category display settings. This allows reusing Species, Quality,
-- Thickness etc. across Panels, Boards, Decking without duplication.
--
-- Safe to drop+recreate because catalog tables are staging-only with only
-- seed data (no user-entered products/variants yet).
-- ============================================================================

-- ─── Drop old tables in dependency order ────────────────────────────────
-- Drop FK from inventory_packages first
ALTER TABLE public.inventory_packages DROP COLUMN IF EXISTS catalog_variant_id;

-- Drop EAV value tables
DROP TABLE IF EXISTS public.catalog_variant_field_values CASCADE;
DROP TABLE IF EXISTS public.catalog_product_field_values CASCADE;

-- Drop image tables
DROP TABLE IF EXISTS public.catalog_variant_images CASCADE;
DROP TABLE IF EXISTS public.catalog_product_images CASCADE;

-- Drop variants and products
DROP TABLE IF EXISTS public.catalog_variants CASCADE;
DROP TABLE IF EXISTS public.catalog_products CASCADE;

-- Drop field options and fields
DROP TABLE IF EXISTS public.catalog_field_options CASCADE;
DROP TABLE IF EXISTS public.catalog_category_fields CASCADE;

-- Drop categories
DROP TABLE IF EXISTS public.catalog_categories CASCADE;

-- ─── 1. catalog_categories ──────────────────────────────────────────────
CREATE TABLE public.catalog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image_storage_path TEXT,
  primary_unit TEXT NOT NULL DEFAULT 'm2'
    CHECK (primary_unit IN ('m2', 'm3', 'piece', 'linear_m')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_categories_active_sort
  ON public.catalog_categories (is_active, sort_order);

-- ─── 2. catalog_fields (GLOBAL field registry) ─────────────────────────
CREATE TABLE public.catalog_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key TEXT NOT NULL UNIQUE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('select', 'number', 'text', 'boolean')),
  unit TEXT,
  ref_table TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. catalog_category_field_assignments (join table) ─────────────────
CREATE TABLE public.catalog_category_field_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.catalog_categories(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.catalog_fields(id) ON DELETE CASCADE,
  applies_to TEXT NOT NULL DEFAULT 'variant'
    CHECK (applies_to IN ('product', 'variant')),
  show_in_filter BOOLEAN NOT NULL DEFAULT false,
  show_in_detail BOOLEAN NOT NULL DEFAULT true,
  show_in_price_list BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category_id, field_id)
);

CREATE INDEX idx_catalog_cfa_category
  ON public.catalog_category_field_assignments (category_id, sort_order);

-- ─── 4. catalog_field_options (options for select-type fields) ──────────
CREATE TABLE public.catalog_field_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES public.catalog_fields(id) ON DELETE CASCADE,
  ref_value_id UUID,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  description_image_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (field_id, value)
);

CREATE INDEX idx_catalog_field_options_field
  ON public.catalog_field_options (field_id, sort_order);

-- ─── 5. catalog_products ────────────────────────────────────────────────
CREATE TABLE public.catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.catalog_categories(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE INDEX idx_catalog_products_category
  ON public.catalog_products (category_id, sort_order);

-- ─── 6. catalog_product_images ──────────────────────────────────────────
CREATE TABLE public.catalog_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_product_images_product
  ON public.catalog_product_images (product_id, sort_order);

-- ─── 7. catalog_product_field_values (EAV — FK to catalog_fields) ───────
CREATE TABLE public.catalog_product_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.catalog_fields(id) ON DELETE CASCADE,
  option_id UUID REFERENCES public.catalog_field_options(id) ON DELETE SET NULL,
  value_text TEXT,
  value_number NUMERIC,
  UNIQUE (product_id, field_id)
);

CREATE INDEX idx_catalog_product_fv_product
  ON public.catalog_product_field_values (product_id);

-- ─── 8. catalog_variants ────────────────────────────────────────────────
CREATE TABLE public.catalog_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE RESTRICT,
  sku TEXT,
  thickness_mm NUMERIC,
  width_mm NUMERIC,
  length_mm NUMERIC,
  length_min_mm NUMERIC,
  length_max_mm NUMERIC,
  price_m2_cents INTEGER,
  price_m3_cents INTEGER,
  price_piece_cents INTEGER,
  price_linear_m_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'GBP',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_variants_product
  ON public.catalog_variants (product_id, sort_order);
CREATE INDEX idx_catalog_variants_dimensions
  ON public.catalog_variants (product_id, thickness_mm, width_mm, length_mm);

-- ─── 9. catalog_variant_images ──────────────────────────────────────────
CREATE TABLE public.catalog_variant_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.catalog_variants(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_variant_images_variant
  ON public.catalog_variant_images (variant_id, sort_order);

-- ─── 10. catalog_variant_field_values (EAV — FK to catalog_fields) ──────
CREATE TABLE public.catalog_variant_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.catalog_variants(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.catalog_fields(id) ON DELETE CASCADE,
  option_id UUID REFERENCES public.catalog_field_options(id) ON DELETE SET NULL,
  value_text TEXT,
  value_number NUMERIC,
  UNIQUE (variant_id, field_id)
);

CREATE INDEX idx_catalog_variant_fv_variant
  ON public.catalog_variant_field_values (variant_id);

-- ─── 11. Re-add inventory_packages link ─────────────────────────────────
ALTER TABLE public.inventory_packages
  ADD COLUMN catalog_variant_id UUID REFERENCES public.catalog_variants(id) ON DELETE SET NULL;

CREATE INDEX idx_inventory_packages_catalog_variant
  ON public.inventory_packages (catalog_variant_id)
  WHERE catalog_variant_id IS NOT NULL;

-- ─── RLS policies ───────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'catalog_categories',
    'catalog_fields',
    'catalog_category_field_assignments',
    'catalog_field_options',
    'catalog_products',
    'catalog_product_images',
    'catalog_product_field_values',
    'catalog_variants',
    'catalog_variant_images',
    'catalog_variant_field_values'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY %1$I_select ON public.%1$I
        FOR SELECT TO authenticated USING (true)
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY %1$I_anon_read ON public.%1$I
        FOR SELECT TO anon USING (true)
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY %1$I_admin_write ON public.%1$I
        FOR ALL TO authenticated
        USING (public.is_current_user_platform_admin())
        WITH CHECK (public.is_current_user_platform_admin())
    $f$, t);
  END LOOP;
END $$;

-- ─── Triggers ───────────────────────────────────────────────────────────
CREATE TRIGGER catalog_categories_updated_at
  BEFORE UPDATE ON public.catalog_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER catalog_fields_updated_at
  BEFORE UPDATE ON public.catalog_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER catalog_field_options_updated_at
  BEFORE UPDATE ON public.catalog_field_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER catalog_products_updated_at
  BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER catalog_variants_updated_at
  BEFORE UPDATE ON public.catalog_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Seed: Global fields + "Solid Wood Panels" category ────────────────

-- Global fields
INSERT INTO public.catalog_fields (id, field_key, field_label, field_type, unit, ref_table) VALUES
  ('f0000001-0001-0000-0000-000000000001', 'wood_species', 'Species',          'select', NULL, 'ref_wood_species'),
  ('f0000001-0002-0000-0000-000000000001', 'panel_type',   'Panel Type',       'select', NULL, 'ref_types'),
  ('f0000001-0003-0000-0000-000000000001', 'processing',   'Processing',       'select', NULL, 'ref_processing'),
  ('f0000001-0004-0000-0000-000000000001', 'humidity',     'Moisture Content', 'select', NULL, 'ref_humidity'),
  ('f0000001-0005-0000-0000-000000000001', 'quality',      'Quality Grade',    'select', NULL, 'ref_quality'),
  ('f0000001-0006-0000-0000-000000000001', 'fsc',          'FSC Certification','select', NULL, 'ref_fsc'),
  ('f0000001-0007-0000-0000-000000000001', 'thickness',    'Thickness',        'number', 'mm', NULL),
  ('f0000001-0008-0000-0000-000000000001', 'width',        'Width',            'number', 'mm', NULL),
  ('f0000001-0009-0000-0000-000000000001', 'length',       'Length',           'number', 'mm', NULL);

-- Category
INSERT INTO public.catalog_categories (id, slug, name, description, primary_unit, sort_order)
VALUES (
  'a0000001-0000-0000-0000-000000000001',
  'solid-wood-panels',
  'Solid Wood Panels',
  'European hardwood solid wood panels — kiln dried, sanded, and ready for use in furniture, worktops, shelving, and interior applications.',
  'm2', 1
);

-- Assign fields to category
INSERT INTO public.catalog_category_field_assignments (category_id, field_id, applies_to, show_in_filter, show_in_detail, show_in_price_list, is_required, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'f0000001-0001-0000-0000-000000000001', 'product', true,  true, false, true,  1),
  ('a0000001-0000-0000-0000-000000000001', 'f0000001-0002-0000-0000-000000000001', 'product', true,  true, false, true,  2),
  ('a0000001-0000-0000-0000-000000000001', 'f0000001-0003-0000-0000-000000000001', 'product', false, true, false, false, 3),
  ('a0000001-0000-0000-0000-000000000001', 'f0000001-0004-0000-0000-000000000001', 'product', false, true, false, false, 4),
  ('a0000001-0000-0000-0000-000000000001', 'f0000001-0005-0000-0000-000000000001', 'variant', true,  true, true,  false, 5),
  ('a0000001-0000-0000-0000-000000000001', 'f0000001-0006-0000-0000-000000000001', 'variant', true,  true, true,  false, 6),
  ('a0000001-0000-0000-0000-000000000001', 'f0000001-0007-0000-0000-000000000001', 'variant', true,  true, true,  false, 7),
  ('a0000001-0000-0000-0000-000000000001', 'f0000001-0008-0000-0000-000000000001', 'variant', false, true, true,  false, 8),
  ('a0000001-0000-0000-0000-000000000001', 'f0000001-0009-0000-0000-000000000001', 'variant', false, true, true,  false, 9);

-- Field options (from existing ref tables, with descriptions)
INSERT INTO public.catalog_field_options (field_id, ref_value_id, value, label, description, sort_order)
SELECT 'f0000001-0001-0000-0000-000000000001', id, value,
  CASE value WHEN 'Oak' THEN 'European Oak' WHEN 'Ash' THEN 'European Ash' WHEN 'Birch' THEN 'Nordic Birch' WHEN 'Pine' THEN 'Scandinavian Pine' ELSE value END,
  CASE value
    WHEN 'Oak'   THEN 'Quercus robur — the gold standard of European hardwoods. Dense, durable, and beautifully grained.'
    WHEN 'Ash'   THEN 'Fraxinus excelsior — a strong, flexible hardwood with a distinctive pale colour and prominent grain.'
    WHEN 'Birch' THEN 'Betula pendula — a light, fine-grained Nordic hardwood with a smooth texture.'
    WHEN 'Pine'  THEN 'Pinus sylvestris — a versatile softwood with a warm tone. Cost-effective for panels and shelving.'
    ELSE NULL END,
  sort_order
FROM public.ref_wood_species WHERE is_active = true;

INSERT INTO public.catalog_field_options (field_id, ref_value_id, value, label, description, sort_order)
SELECT 'f0000001-0002-0000-0000-000000000001', id, value,
  CASE value WHEN 'FJ' THEN 'Finger Joint' WHEN 'Full stave' THEN 'Full Stave' ELSE value END,
  CASE value
    WHEN 'FJ'         THEN 'Finger-jointed construction joins shorter pieces end-to-end. Cost-effective with excellent structural integrity.'
    WHEN 'Full stave' THEN 'Full stave panels use long, unjointed strips edge-glued together. Premium appearance with uninterrupted grain.'
    ELSE NULL END,
  sort_order
FROM public.ref_types WHERE is_active = true;

INSERT INTO public.catalog_field_options (field_id, ref_value_id, value, label, description, sort_order)
SELECT 'f0000001-0003-0000-0000-000000000001', id, value, value, NULL, sort_order
FROM public.ref_processing WHERE is_active = true;

INSERT INTO public.catalog_field_options (field_id, ref_value_id, value, label, description, sort_order)
SELECT 'f0000001-0004-0000-0000-000000000001', id, value, value,
  CASE value
    WHEN 'KD 7-9%'  THEN 'Kiln dried to 7-9% moisture — ideal for interior furniture and panels.'
    WHEN 'KD 9-11%' THEN 'Kiln dried to 9-11% moisture — suitable for interior applications with moderate humidity.'
    ELSE NULL END,
  sort_order
FROM public.ref_humidity WHERE is_active = true;

INSERT INTO public.catalog_field_options (field_id, ref_value_id, value, label, description, sort_order)
SELECT 'f0000001-0005-0000-0000-000000000001', id, value,
  CASE value WHEN 'AA' THEN 'AA Premium' WHEN 'AV' THEN 'AV Select' WHEN 'AS' THEN 'AS Standard' WHEN 'BC' THEN 'BC Character' WHEN 'CC' THEN 'CC Rustic' WHEN 'ABC' THEN 'ABC Mixed' ELSE value END,
  CASE value
    WHEN 'AA'  THEN 'Highest grade — virtually defect-free with uniform colour and grain.'
    WHEN 'AV'  THEN 'High quality with minor natural features. Excellent balance of appearance and value.'
    WHEN 'BC'  THEN 'Character grade allowing knots and colour variation. Popular for rustic aesthetics.'
    WHEN 'CC'  THEN 'Rustic grade with prominent natural features. Cost-effective for non-visible applications.'
    WHEN 'ABC' THEN 'Mixed grade — a blend of quality levels sorted from the same batch.'
    ELSE NULL END,
  sort_order
FROM public.ref_quality WHERE is_active = true;

INSERT INTO public.catalog_field_options (field_id, ref_value_id, value, label, description, sort_order)
SELECT 'f0000001-0006-0000-0000-000000000001', id, value, value,
  CASE value
    WHEN 'FSC 100%'      THEN 'All wood comes from FSC-certified forests, ensuring responsible forest management.'
    WHEN 'FSC Credit Mix' THEN 'A proportion of wood is FSC-certified, with the remainder from controlled sources.'
    WHEN 'No'             THEN 'Not FSC certified. Wood sourced from legal, verified suppliers.'
    ELSE NULL END,
  sort_order
FROM public.ref_fsc WHERE is_active = true;
