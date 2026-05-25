-- RLS on remaining multi-tenant + reference tables (cluster 5).
--
-- Pattern: parent-cascade for child tables (filter via EXISTS on the
-- already-RLS'd parent); read-anyone-write-admin for global reference
-- tables; admin-only for CRM and other single-tenant tables.
--
-- Paired rollback: 20260522000010_rls_remaining_tables_rollback.sql.disabled

-- ─── Reference tables (global catalogue) ─────────────────────────────────
-- Read by any authenticated user, write platform-admin only.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'ref_fsc', 'ref_humidity', 'ref_processes', 'ref_processing',
    'ref_product_names', 'ref_quality', 'ref_types', 'ref_wood_species',
    'module_presets'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY %1$I_select ON public.%1$I
        FOR SELECT TO authenticated USING (true)
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY %1$I_admin_write ON public.%1$I
        FOR ALL TO authenticated
        USING (public.is_current_user_platform_admin())
        WITH CHECK (public.is_current_user_platform_admin())
    $f$, t);
  END LOOP;
END $$;

-- ─── Child tables linked to RLS-protected parents ────────────────────────
-- Pattern: a SELECT on the child returns nothing if the parent SELECT
-- already returns nothing (parent's RLS does the actual filtering).
-- Same for writes via WITH CHECK on the parent visibility.

-- order_shipments — links orders to shipments. Visible if either side is.
ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_shipments_select ON public.order_shipments
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR EXISTS (SELECT 1 FROM public.orders WHERE id = order_shipments.order_id)
    OR EXISTS (SELECT 1 FROM public.shipments WHERE id = order_shipments.shipment_id)
  );
CREATE POLICY order_shipments_write ON public.order_shipments
  FOR ALL TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR (EXISTS (SELECT 1 FROM public.orders WHERE id = order_shipments.order_id)
        AND EXISTS (SELECT 1 FROM public.shipments WHERE id = order_shipments.shipment_id))
  )
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR (EXISTS (SELECT 1 FROM public.orders WHERE id = order_shipments.order_id)
        AND EXISTS (SELECT 1 FROM public.shipments WHERE id = order_shipments.shipment_id))
  );

-- shipment_pallets — child of shipments.
ALTER TABLE public.shipment_pallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipment_pallets_select ON public.shipment_pallets
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR EXISTS (SELECT 1 FROM public.shipments WHERE id = shipment_pallets.shipment_id)
  );
CREATE POLICY shipment_pallets_write ON public.shipment_pallets
  FOR ALL TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR EXISTS (SELECT 1 FROM public.shipments WHERE id = shipment_pallets.shipment_id)
  )
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR EXISTS (SELECT 1 FROM public.shipments WHERE id = shipment_pallets.shipment_id)
  );

-- Production children — all parented by portal_production_entries.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'portal_production_inputs', 'portal_production_outputs', 'portal_production_lines'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY %1$I_select ON public.%1$I
        FOR SELECT TO authenticated
        USING (
          public.is_current_user_platform_admin()
          OR EXISTS (SELECT 1 FROM public.portal_production_entries
                     WHERE id = %1$I.production_entry_id)
        )
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY %1$I_write ON public.%1$I
        FOR ALL TO authenticated
        USING (
          public.is_current_user_platform_admin()
          OR EXISTS (SELECT 1 FROM public.portal_production_entries
                     WHERE id = %1$I.production_entry_id)
        )
        WITH CHECK (
          public.is_current_user_platform_admin()
          OR EXISTS (SELECT 1 FROM public.portal_production_entries
                     WHERE id = %1$I.production_entry_id)
        )
    $f$, t);
  END LOOP;
END $$;

-- ─── audit_log ───────────────────────────────────────────────────────────
-- Visible to members of the target org or platform admin. Writes are
-- admin-only (audit log inserts go through admin paths).
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(target_org_id)
  );
CREATE POLICY audit_log_admin_write ON public.audit_log
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- ─── organization_relationships ──────────────────────────────────────────
-- Visible if user is in either party org. Writes admin only.
ALTER TABLE public.organization_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_relationships_select ON public.organization_relationships
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(party_a_id)
    OR public.current_user_in_org(party_b_id)
  );
CREATE POLICY organization_relationships_admin_write ON public.organization_relationships
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- ─── CRM tables — platform admin only ────────────────────────────────────
-- CRM is currently single-tenant (admin use only). Lock down entirely;
-- if multi-tenant CRM is wanted later, replace these policies with
-- something org-scoped.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['crm_company_keywords', 'crm_keywords'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY %1$I_admin_all ON public.%1$I
        FOR ALL TO authenticated
        USING (public.is_current_user_platform_admin())
        WITH CHECK (public.is_current_user_platform_admin())
    $f$, t);
  END LOOP;
END $$;

-- ─── Internal / counter / legacy tables — platform admin only ────────────
-- production_package_counters: per-org counter table, accessed via
-- service-role from validateProduction. Lock to admin-only via RLS so
-- nothing else can sneak in.
-- portal_inventory / portal_products: legacy MVP tables, no longer
-- actively used by org-user flows.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'production_package_counters', 'portal_inventory', 'portal_products'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY %1$I_admin_all ON public.%1$I
        FOR ALL TO authenticated
        USING (public.is_current_user_platform_admin())
        WITH CHECK (public.is_current_user_platform_admin())
    $f$, t);
  END LOOP;
END $$;
