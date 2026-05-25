-- RLS on the auth + permissions tables (cluster 4).
--
-- These are the most delicate tables because the login flow itself
-- (proxy.ts middleware, getSession()) queries them with the user-context
-- client. Wrong policy = users locked out.
--
-- Helpers (current_portal_user_id, is_current_user_platform_admin,
-- current_user_in_org) are all STABLE SECURITY DEFINER (see
-- 20260522000002_rls_helpers.sql) — they bypass RLS internally, so
-- enabling RLS on the tables they read does not cause recursion.
--
-- Paired rollback: 20260522000008_rls_auth_permissions_rollback.sql.disabled

-- ─── modules ─────────────────────────────────────────────────────────────
-- Global module catalog. Any authenticated user can read it (sidebar +
-- permission checks). Only platform admins can mutate.
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY modules_select ON public.modules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY modules_admin_write ON public.modules
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- ─── organisations ───────────────────────────────────────────────────────
-- Members can read their orgs; platform admin reads all. Mutations are
-- platform-admin only (org creation/edits happen via admin actions).
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organisations_select ON public.organisations
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(id)
  );

CREATE POLICY organisations_admin_write ON public.organisations
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- ─── portal_users ────────────────────────────────────────────────────────
-- A user can always read their own row (login flow depends on this).
-- Platform admin reads all. Same-org members can read each other (needed
-- for the admin "Users in this org" listing for org admins).
-- Mutations restricted to platform admins; user creation flows that need
-- broader access use the service-role client which bypasses RLS.
ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY portal_users_select ON public.portal_users
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
  );

CREATE POLICY portal_users_admin_write ON public.portal_users
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- ─── organization_memberships ────────────────────────────────────────────
-- A user can read their own memberships (getSession depends on this).
-- Platform admin reads all. Mutations admin only.
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_memberships_select ON public.organization_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = public.current_portal_user_id()
    OR public.is_current_user_platform_admin()
  );

CREATE POLICY organization_memberships_admin_write ON public.organization_memberships
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- ─── user_modules ────────────────────────────────────────────────────────
-- A user can read their own module assignments (sidebar / permission UI
-- depends on this). Platform admin reads all. Mutations admin only.
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_modules_select ON public.user_modules
  FOR SELECT TO authenticated
  USING (
    user_id = public.current_portal_user_id()
    OR public.is_current_user_platform_admin()
  );

CREATE POLICY user_modules_admin_write ON public.user_modules
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- ─── organization_modules ────────────────────────────────────────────────
-- Members of the org can read its module configuration (orgHasModule
-- checks need this). Platform admin reads all. Mutations admin only.
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_modules_select ON public.organization_modules
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organization_id)
  );

CREATE POLICY organization_modules_admin_write ON public.organization_modules
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

COMMENT ON TABLE public.modules IS 'RLS enabled 2026-05-22: read by any authenticated user, write platform admin only.';
COMMENT ON TABLE public.organisations IS 'RLS enabled 2026-05-22: read by org members or platform admin, write platform admin only.';
COMMENT ON TABLE public.portal_users IS 'RLS enabled 2026-05-22: read own row / same-org / platform admin; write platform admin only.';
COMMENT ON TABLE public.organization_memberships IS 'RLS enabled 2026-05-22: read own / platform admin; write platform admin only.';
COMMENT ON TABLE public.user_modules IS 'RLS enabled 2026-05-22: read own / platform admin; write platform admin only.';
COMMENT ON TABLE public.organization_modules IS 'RLS enabled 2026-05-22: read by org members / platform admin; write platform admin only.';
