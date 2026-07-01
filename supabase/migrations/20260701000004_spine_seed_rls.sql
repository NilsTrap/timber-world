-- E2 · Spine write policies — admin/service only.
-- Splits the E1 `spines_write_admin` (FOR ALL) into explicit INSERT/UPDATE/DELETE,
-- all admin-gated. Deal creation seeds spines via the admin/service client (the
-- only createDeal caller today is the MCP route on createAdminClient, which
-- bypasses RLS). A future portal org-user create path will seed the spine via an
-- admin-client step in the server action, or a tightly-scoped policy added in E3 —
-- NOT a blanket authenticated INSERT (that allowed SP-code squatting + forged
-- created_by). Idempotent.

DROP POLICY IF EXISTS spines_write_admin ON public.spines;
DROP POLICY IF EXISTS spines_insert_authenticated ON public.spines;

DROP POLICY IF EXISTS spines_insert_admin ON public.spines;
CREATE POLICY spines_insert_admin ON public.spines
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_platform_admin());

DROP POLICY IF EXISTS spines_update_admin ON public.spines;
CREATE POLICY spines_update_admin ON public.spines
  FOR UPDATE TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

DROP POLICY IF EXISTS spines_delete_admin ON public.spines;
CREATE POLICY spines_delete_admin ON public.spines
  FOR DELETE TO authenticated
  USING (public.is_current_user_platform_admin());
