-- Metal Stairs catalogue fixture.
--
-- Additive and idempotent: preserves product/EAV values entered by users,
-- creates only missing records, and never populates commercial values.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_categories WHERE slug = 'metal-stairs'
  ) THEN
    RAISE EXCEPTION 'METAL_STAIRS_CATEGORY_NOT_FOUND';
  END IF;
END $$;

-- Reusable technical fields. Existing fields are retained; only their units
-- are normalised so specification snapshots display meaningful measurements.
INSERT INTO public.catalog_fields (field_key, field_label, field_type, unit, ref_table)
VALUES
  ('material_grade',       'Material grade',       'text',   NULL, NULL),
  ('net_weight',           'Net weight',           'number', 'kg', NULL),
  ('gross_weight',         'Gross weight',         'number', 'kg', NULL),
  ('part_count',           'Part count',           'number', 'pcs', NULL),
  ('total_surface_area',   'Total surface area',   'number', 'm²', NULL),
  ('visible_surface_area', 'Visible surface area', 'number', 'm²', NULL),
  ('hidden_surface_area',  'Hidden surface area',  'number', 'm²', NULL),
  ('colour_code',          'Colour code',          'text',   NULL, NULL),
  ('outer_diameter',       'Outer diameter',       'number', 'mm', NULL),
  ('wall_thickness',       'Wall thickness',       'number', 'mm', NULL)
ON CONFLICT (field_key) DO NOTHING;

-- The process registry is shared across categories. Process values are
-- intentionally absent here: a catalogue product describes available fields,
-- while job-specific process quantities remain blank until a dedicated project input flow exists.
INSERT INTO public.catalog_fields (field_key, field_label, field_type, unit, ref_table)
VALUES
  ('metal',           'Metal',           'number', 'kg',  NULL),
  ('cutting',         'Cutting',         'number', 'm',   NULL),
  ('bending',         'Bending',         'number', 'm',   NULL),
  ('straightening',   'Straightening',   'number', 'm',   NULL),
  ('countersinking',  'Countersinking',  'number', 'm',   NULL),
  ('rolling',         'Rolling',         'number', 'm',   NULL),
  ('welding',         'Welding',         'number', 'm',   NULL),
  ('galvanizing',     'Galvanizing',     'number', 'kg',  NULL),
  ('painting',        'Painting',        'number', 'm²',  NULL),
  ('shot_blasting',   'Shot blasting',   'number', 'm²',  NULL),
  ('powder_priming',  'Powder priming',  'number', 'm²',  NULL),
  ('powder_coating',  'Powder coating',  'number', 'm²',  NULL),
  ('wet_priming',     'Wet priming',     'number', 'm²',  NULL),
  ('wet_painting',    'Wet painting',    'number', 'm²',  NULL),
  ('packaging',       'Packaging',       'number', 'pcs', NULL),
  ('transport',       'Transport',       'number', 'km',  NULL)
ON CONFLICT (field_key) DO NOTHING;

-- Category field layout. Upserting assignment metadata makes a rerun repair
-- configuration drift without touching any product or variant field values.
INSERT INTO public.catalog_category_field_assignments
  (category_id, field_id, applies_to, show_in_filter, show_in_detail,
   show_in_price_list, is_required, sort_order)
SELECT category.id, field.id, assignment.applies_to, false, true, false, false,
       assignment.sort_order
FROM (VALUES
  ('material_grade',       'product',  10),
  ('net_weight',           'product',  20),
  ('gross_weight',         'product',  30),
  ('part_count',           'product',  40),
  ('total_surface_area',   'product',  50),
  ('visible_surface_area', 'product',  60),
  ('hidden_surface_area',  'product',  70),
  ('colour_code',          'product',  80),
  ('thickness',            'variant',  10),
  ('width',                'variant',  20),
  ('length',               'variant',  30),
  ('outer_diameter',       'variant',  40),
  ('wall_thickness',       'variant',  50),
  ('metal',                'process',  10),
  ('cutting',              'process',  20),
  ('bending',              'process',  30),
  ('straightening',        'process',  40),
  ('countersinking',       'process',  50),
  ('rolling',              'process',  60),
  ('welding',              'process',  70),
  ('galvanizing',          'process',  80),
  ('painting',             'process',  90),
  ('shot_blasting',        'process', 100),
  ('powder_priming',       'process', 110),
  ('powder_coating',       'process', 120),
  ('wet_priming',          'process', 130),
  ('wet_painting',         'process', 140),
  ('packaging',            'process', 150),
  ('transport',            'process', 160)
) AS assignment(field_key, applies_to, sort_order)
JOIN public.catalog_categories category ON category.slug = 'metal-stairs'
JOIN public.catalog_fields field ON field.field_key = assignment.field_key
ON CONFLICT (category_id, field_id) DO NOTHING;

-- Preserve the three existing records and add the five missing reusable
-- profiles. No descriptions, dimensions, EAV values, or prices are invented.
INSERT INTO public.catalog_products
  (category_id, slug, name, is_active, sort_order,
   visible_agents, visible_internal, visible_marketing)
SELECT category.id, product.slug, product.name, true, product.sort_order,
       false, true, false
FROM (VALUES
  ('metal-sheets',       'Metal sheets',       10),
  ('round-tube',         'Round tube',         20),
  ('square-tube',        'Square tube',        30),
  ('rectangular-tube',   'Rectangular tube',   40),
  ('flat-bar',           'Flat bar',           50),
  ('angle-profile',      'Angle profile',      60),
  ('channel-profile',    'Channel profile',    70),
  ('structural-profile', 'Structural profile', 80)
) AS product(slug, name, sort_order)
JOIN public.catalog_categories category ON category.slug = 'metal-stairs'
ON CONFLICT (category_id, slug) DO NOTHING;

-- The approved target products are active and visible in the internal picker.
-- Product names and all user-entered values remain untouched on rerun.
UPDATE public.catalog_products product
SET is_active = true,
    visible_internal = true
FROM public.catalog_categories category
WHERE product.category_id = category.id
  AND category.slug = 'metal-stairs'
  AND product.slug IN (
    'metal-sheets', 'round-tube', 'square-tube', 'rectangular-tube',
    'flat-bar', 'angle-profile', 'channel-profile', 'structural-profile'
  )
  AND (NOT product.is_active OR NOT product.visible_internal);

-- A neutral variant is required by the project catalogue-import boundary.
-- Its null dimensions and null price deliberately defer all job data to the
-- project specification. NOT EXISTS provides rerun safety because variants do
-- not have a database uniqueness constraint on (product_id, sku).
DO $$
BEGIN
  -- Serialize this fixture's variant reconciliation so concurrent reruns cannot
  -- both pass the NOT EXISTS check.
  PERFORM pg_advisory_xact_lock(hashtextextended('metal_stairs_custom_dimensions', 0));

  UPDATE public.catalog_variants variant
  SET is_active = true
  FROM public.catalog_products product
  JOIN public.catalog_categories category ON category.id = product.category_id
  WHERE variant.product_id = product.id
    AND category.slug = 'metal-stairs'
    AND product.slug IN (
      'metal-sheets', 'round-tube', 'square-tube', 'rectangular-tube',
      'flat-bar', 'angle-profile', 'channel-profile', 'structural-profile'
    )
    AND lower(btrim(coalesce(variant.sku, ''))) = 'custom dimensions'
    AND NOT variant.is_active;

  INSERT INTO public.catalog_variants
    (product_id, sku, thickness_mm, width_mm, length_mm, length_min_mm,
     length_max_mm, price_eur_cents, is_active, sort_order)
  SELECT product.id, 'Custom dimensions', NULL, NULL, NULL, NULL, NULL, NULL,
         true, 0
  FROM public.catalog_products product
  JOIN public.catalog_categories category ON category.id = product.category_id
  WHERE category.slug = 'metal-stairs'
    AND product.slug IN (
      'metal-sheets', 'round-tube', 'square-tube', 'rectangular-tube',
      'flat-bar', 'angle-profile', 'channel-profile', 'structural-profile'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.catalog_variants variant
      WHERE variant.product_id = product.id
        AND lower(btrim(coalesce(variant.sku, ''))) = 'custom dimensions'
    );
END $$;
