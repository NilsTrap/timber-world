-- RLS on the three core operational tables: inventory_packages, shipments,
-- portal_production_entries. Same model as orders (20260522000003):
--   - SELECT/INSERT/UPDATE/DELETE limited to platform admins or members
--     of the relevant org column(s) on the row.
--
-- Paired rollback is in 20260522000006_rls_inventory_shipments_production_rollback.sql.disabled.

-- ─── inventory_packages ──────────────────────────────────────────────────
ALTER TABLE public.inventory_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_packages_select_authenticated ON public.inventory_packages
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  );

CREATE POLICY inventory_packages_insert_authenticated ON public.inventory_packages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  );

CREATE POLICY inventory_packages_update_authenticated ON public.inventory_packages
  FOR UPDATE TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  )
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  );

CREATE POLICY inventory_packages_delete_authenticated ON public.inventory_packages
  FOR DELETE TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  );

COMMENT ON TABLE public.inventory_packages IS
  'RLS enabled 2026-05-22: authenticated users see/modify only packages where they are a member of the owning organisation, or platform admins.';

-- ─── shipments ───────────────────────────────────────────────────────────
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY shipments_select_authenticated ON public.shipments
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(from_organisation_id)
    OR public.current_user_in_org(to_organisation_id)
  );

CREATE POLICY shipments_insert_authenticated ON public.shipments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(from_organisation_id)
    OR public.current_user_in_org(to_organisation_id)
  );

CREATE POLICY shipments_update_authenticated ON public.shipments
  FOR UPDATE TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(from_organisation_id)
    OR public.current_user_in_org(to_organisation_id)
  )
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(from_organisation_id)
    OR public.current_user_in_org(to_organisation_id)
  );

CREATE POLICY shipments_delete_authenticated ON public.shipments
  FOR DELETE TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(from_organisation_id)
    OR public.current_user_in_org(to_organisation_id)
  );

COMMENT ON TABLE public.shipments IS
  'RLS enabled 2026-05-22: authenticated users see/modify only shipments where they are a member of the from or to organisation, or platform admins.';

-- ─── portal_production_entries ───────────────────────────────────────────
ALTER TABLE public.portal_production_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY portal_production_entries_select_authenticated ON public.portal_production_entries
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  );

CREATE POLICY portal_production_entries_insert_authenticated ON public.portal_production_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  );

CREATE POLICY portal_production_entries_update_authenticated ON public.portal_production_entries
  FOR UPDATE TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  )
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  );

CREATE POLICY portal_production_entries_delete_authenticated ON public.portal_production_entries
  FOR DELETE TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  );

COMMENT ON TABLE public.portal_production_entries IS
  'RLS enabled 2026-05-22: authenticated users see/modify only production entries where they are a member of the owning organisation, or platform admins.';
