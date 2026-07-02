-- =============================================
-- E5 · Seed real product categories: firewood, boards, stairs
-- Migration: 20260701000016_seed_catalog_categories.sql
--
-- Populates Nils's real product groups as catalog categories with their spec
-- fields (which drive both the deal picker and the AI's questions). Reuses the
-- existing global fields; adds two stairs-specific select fields with DIRECT
-- options (no ref_* backing — new vocabulary, not in the legacy ref tables, so
-- the ref→options sync trigger simply doesn't touch them).
--
-- Idempotent AND drift-safe: categories upsert on SLUG (a `firewood` category
-- may already exist from manual staging work — we reuse it rather than
-- duplicate), and field assignments resolve the category by slug, so they
-- attach whether the category is our seeded row or a pre-existing one. The
-- `stairs` category is built ALONGSIDE the flat uk_staircase_pricing table
-- (kept in parallel), not as a replacement.
-- =============================================

-- 1. New global select fields for stairs (direct options, ref_table NULL)
INSERT INTO public.catalog_fields (id, field_key, field_label, field_type, unit, ref_table) VALUES
  ('f0000001-0011-0000-0000-000000000001', 'stair_family', 'Stair Family', 'select', NULL, NULL),
  ('f0000001-0012-0000-0000-000000000001', 'joint_type',   'Joint Type',   'select', NULL, NULL)
ON CONFLICT (field_key) DO NOTHING;

INSERT INTO public.catalog_field_options (field_id, value, label, sort_order)
SELECT f.id, o.value, o.label, o.sort_order
FROM (VALUES
  ('stair_family', 'Step',    'Step',    1),
  ('stair_family', 'Winder',  'Winder',  2),
  ('stair_family', 'Quarter', 'Quarter', 3),
  ('joint_type',   'FJ',   'Finger Joint (FJ)',                1),
  ('joint_type',   'FS',   'Full Stave (FS)',                  2),
  ('joint_type',   'FJFS', 'Finger Joint / Full Stave (FJFS)', 3)
) AS o(field_key, value, label, sort_order)
JOIN public.catalog_fields f ON f.field_key = o.field_key
ON CONFLICT (field_id, value) DO NOTHING;

-- 2. Categories (upsert on slug — reuse any pre-existing row)
INSERT INTO public.catalog_categories (id, slug, name, description, primary_unit, sort_order) VALUES
  ('a0000001-0002-0000-0000-000000000001', 'firewood', 'Firewood',
   'Kiln-dried and seasoned firewood — sold by crate or loose cubic metre.', 'm3', 2),
  ('a0000001-0003-0000-0000-000000000001', 'boards', 'Boards',
   'Sawn and processed timber boards — by species, grade, and dimension.', 'm3', 3),
  ('a0000001-0004-0000-0000-000000000001', 'stairs', 'Stairs',
   'Staircase components — steps, winders and quarters in finger-joint or full-stave construction.', 'piece', 4)
ON CONFLICT (slug) DO NOTHING;

-- 3. Field assignments — resolve category by slug + field by key so this works
--    against our seeded UUIDs OR a pre-existing category row.
INSERT INTO public.catalog_category_field_assignments
  (category_id, field_id, applies_to, show_in_filter, show_in_detail, show_in_price_list, is_required, sort_order)
SELECT cat.id, fld.id, a.applies_to, a.show_in_filter, a.show_in_detail, a.show_in_price_list, a.is_required, a.sort_order
FROM (VALUES
  -- Firewood: species + moisture + certificate (product); length (variant).
  ('firewood', 'wood_species', 'product', true,  true,  false, true,  1),
  ('firewood', 'humidity',     'product', true,  true,  false, false, 2),
  ('firewood', 'fsc',          'product', false, true,  false, false, 3),
  ('firewood', 'length',       'variant', false, true,  true,  false, 4),
  -- Boards: species + type + grade + processing + certificate (product); dims (variant).
  ('boards', 'wood_species', 'product', true,  true,  false, true,  1),
  ('boards', 'panel_type',   'product', true,  true,  false, false, 2),
  ('boards', 'quality',      'product', true,  true,  false, false, 3),
  ('boards', 'processing',   'product', false, true,  false, false, 4),
  ('boards', 'fsc',          'product', false, true,  false, false, 5),
  ('boards', 'thickness',    'variant', true,  true,  true,  false, 6),
  ('boards', 'width',        'variant', false, true,  true,  false, 7),
  ('boards', 'length',       'variant', false, true,  true,  false, 8),
  -- Stairs: family + joint type + species (product); dims + riser (variant).
  ('stairs', 'stair_family', 'product', true,  true,  false, true,  1),
  ('stairs', 'joint_type',   'product', true,  true,  false, true,  2),
  ('stairs', 'wood_species', 'product', true,  true,  false, false, 3),
  ('stairs', 'thickness',    'variant', true,  true,  true,  false, 4),
  ('stairs', 'width',        'variant', false, true,  true,  false, 5),
  ('stairs', 'length',       'variant', false, true,  true,  false, 6),
  ('stairs', 'riser',        'variant', false, true,  true,  false, 7)
) AS a(cat_slug, field_key, applies_to, show_in_filter, show_in_detail, show_in_price_list, is_required, sort_order)
JOIN public.catalog_categories cat ON cat.slug = a.cat_slug
JOIN public.catalog_fields fld ON fld.field_key = a.field_key
ON CONFLICT (category_id, field_id) DO NOTHING;
