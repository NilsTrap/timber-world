-- Fix: marketing website stock page broken after RLS rollout (2026-05-22).
--
-- The marketing site uses the Supabase anon key (no auth session) to query
-- inventory_packages + organisations + ref_* tables. All RLS policies were
-- written as TO authenticated, so anonymous visitors get zero rows.
--
-- Solution: add read-only policies for the anon role on the specific tables
-- the marketing site needs, with restrictive conditions.

-- ─── organisations ──────────────────────────────────────────────────────
-- Marketing site only needs to find marketing-enabled internal orgs (IDs).
CREATE POLICY organisations_anon_marketing_read ON public.organisations
  FOR SELECT TO anon
  USING (
    is_active = true
    AND marketing_enabled = true
    AND is_external = false
  );

-- ─── inventory_packages ─────────────────────────────────────────────────
-- Marketing site shows only available packages from marketing-enabled orgs.
-- The org filter is enforced by the query (org IDs from above), but we also
-- restrict at the RLS level to only available status.
CREATE POLICY inventory_packages_anon_stock_read ON public.inventory_packages
  FOR SELECT TO anon
  USING (
    status = 'available'
    AND EXISTS (
      SELECT 1 FROM public.organisations o
      WHERE o.id = organisation_id
        AND o.is_active = true
        AND o.marketing_enabled = true
        AND o.is_external = false
    )
  );

-- ─── Reference tables ───────────────────────────────────────────────────
-- Marketing site joins these for display values. Safe to expose read-only.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'ref_fsc', 'ref_humidity', 'ref_processing',
    'ref_product_names', 'ref_quality', 'ref_types', 'ref_wood_species'
  ])
  LOOP
    EXECUTE format($f$
      CREATE POLICY %1$I_anon_read ON public.%1$I
        FOR SELECT TO anon USING (true)
    $f$, t);
  END LOOP;
END $$;
