-- ============================================================================
-- Variant Packages — defines how variants are physically packaged for sale.
-- E.g., "Standard Pack: 10 boards, 6.2 m², £322.40"
-- ============================================================================

CREATE TABLE public.catalog_variant_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.catalog_variants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Standard Pack',
  pieces_per_package INTEGER NOT NULL CHECK (pieces_per_package > 0),
  volume_m3 NUMERIC,
  area_m2 NUMERIC,
  weight_kg NUMERIC,
  package_price_cents INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_variant_packages_variant
  ON public.catalog_variant_packages (variant_id, sort_order);

-- RLS
ALTER TABLE public.catalog_variant_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_variant_packages_select ON public.catalog_variant_packages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY catalog_variant_packages_anon_read ON public.catalog_variant_packages
  FOR SELECT TO anon USING (true);

CREATE POLICY catalog_variant_packages_admin_write ON public.catalog_variant_packages
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- Trigger
CREATE TRIGGER catalog_variant_packages_updated_at
  BEFORE UPDATE ON public.catalog_variant_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
