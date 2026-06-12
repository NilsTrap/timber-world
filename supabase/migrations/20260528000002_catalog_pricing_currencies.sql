-- ============================================================================
-- Catalog pricing model + multi-currency
--
-- 1. Admin-managed pricing units (m²/m³/linear m/piece) with a calc_method
--    that derives billable quantity from variant dimensions.
-- 2. Protected "system" dimension fields (Width/Length/Thickness) with a
--    stable dimension_role so pricing always finds them and they can't be
--    deleted from the field admin.
-- 3. EUR-base price cascade: category default rate -> product base rate ->
--    variant override. Replaces the four per-unit GBP price columns.
-- 4. Currencies (EUR base) + derived per-currency prices, populated by a
--    manual ECB conversion run with UK charm rounding.
--
-- Catalog tables are staging-only with seed data, so destructive column
-- changes are safe here.
-- ============================================================================

-- ─── 1. catalog_pricing_units (admin-managed) ──────────────────────────────
CREATE TABLE public.catalog_pricing_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  calc_method TEXT NOT NULL
    CHECK (calc_method IN ('per_piece', 'area', 'volume', 'length')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.catalog_pricing_units (code, name, symbol, calc_method, sort_order) VALUES
  ('m2',       'Square meter', 'm²',  'area',      1),
  ('m3',       'Cubic meter',  'm³',  'volume',    2),
  ('linear_m', 'Linear meter', 'm',   'length',    3),
  ('piece',    'Piece',        'pcs', 'per_piece', 4);

-- Link category.primary_unit to the units table (drop the old hard-coded CHECK)
ALTER TABLE public.catalog_categories
  DROP CONSTRAINT IF EXISTS catalog_categories_primary_unit_check;
ALTER TABLE public.catalog_categories
  ADD CONSTRAINT catalog_categories_primary_unit_fkey
  FOREIGN KEY (primary_unit) REFERENCES public.catalog_pricing_units(code)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- ─── 2. Protected system dimension fields ──────────────────────────────────
ALTER TABLE public.catalog_fields
  ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN dimension_role TEXT
    CHECK (dimension_role IS NULL OR dimension_role IN ('width', 'length', 'thickness'));

UPDATE public.catalog_fields SET is_system = true, dimension_role = 'thickness'
  WHERE id = 'f0000001-0007-0000-0000-000000000001';
UPDATE public.catalog_fields SET is_system = true, dimension_role = 'width'
  WHERE id = 'f0000001-0008-0000-0000-000000000001';
UPDATE public.catalog_fields SET is_system = true, dimension_role = 'length'
  WHERE id = 'f0000001-0009-0000-0000-000000000001';

-- ─── 3. EUR-base price cascade ─────────────────────────────────────────────
ALTER TABLE public.catalog_categories ADD COLUMN default_price_eur_cents INTEGER;
ALTER TABLE public.catalog_products   ADD COLUMN base_price_eur_cents INTEGER;
ALTER TABLE public.catalog_variants   ADD COLUMN price_eur_cents INTEGER;

-- Preserve existing test prices: take the column matching the category's unit.
UPDATE public.catalog_variants v SET price_eur_cents = sub.cents
FROM (
  SELECT v2.id,
    CASE c.primary_unit
      WHEN 'm2'       THEN v2.price_m2_cents
      WHEN 'm3'       THEN v2.price_m3_cents
      WHEN 'piece'    THEN v2.price_piece_cents
      WHEN 'linear_m' THEN v2.price_linear_m_cents
    END AS cents
  FROM public.catalog_variants v2
  JOIN public.catalog_products p   ON p.id = v2.product_id
  JOIN public.catalog_categories c ON c.id = p.category_id
) sub
WHERE sub.id = v.id;

ALTER TABLE public.catalog_variants
  DROP COLUMN price_m2_cents,
  DROP COLUMN price_m3_cents,
  DROP COLUMN price_piece_cents,
  DROP COLUMN price_linear_m_cents,
  DROP COLUMN currency;

-- ─── 4. Currencies (EUR base + derived) ────────────────────────────────────
CREATE TABLE public.catalog_currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_base BOOLEAN NOT NULL DEFAULT false,
  -- units of this currency per 1 EUR (base = 1)
  exchange_rate NUMERIC,
  rate_source TEXT,
  rate_fetched_at TIMESTAMPTZ,
  -- editable charm-rounding band config (see lib/pricing/charmRounding.ts)
  rounding_rule JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.catalog_currencies (code, name, symbol, is_base, exchange_rate, is_active, sort_order)
VALUES ('EUR', 'Euro', '€', true, 1, true, 1);

INSERT INTO public.catalog_currencies (code, name, symbol, is_base, is_active, sort_order, rounding_rule)
VALUES ('GBP', 'British Pound', '£', false, true, 2,
  '{"bands": [
      {"upTo": 20,   "endings": [0.29, 0.49, 0.79, 0.99]},
      {"upTo": 100,  "endings": [0.99]},
      {"upTo": null, "stepEnding": {"step": 10, "minus": 0.01}}
  ]}'::jsonb);

-- Derived per-currency prices (regenerated by the conversion run).
CREATE TABLE public.catalog_currency_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('category', 'product', 'variant')),
  entity_id UUID NOT NULL,
  currency_code TEXT NOT NULL REFERENCES public.catalog_currencies(code) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, currency_code)
);

CREATE INDEX idx_catalog_currency_prices_lookup
  ON public.catalog_currency_prices (currency_code, entity_type, entity_id);

-- ─── 5. RLS (mirror existing catalog pattern) ──────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'catalog_pricing_units',
    'catalog_currencies',
    'catalog_currency_prices'
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

-- ─── 6. Triggers ───────────────────────────────────────────────────────────
CREATE TRIGGER catalog_pricing_units_updated_at
  BEFORE UPDATE ON public.catalog_pricing_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER catalog_currencies_updated_at
  BEFORE UPDATE ON public.catalog_currencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
