-- E2 · Let authenticated users SEED a spine when they create a deal.
-- Deal creation (portal or MCP) now puts every deal on a spine, so a plain INSERT
-- of a spine must be allowed for any authenticated user. Structural spine ops
-- (Spec→Lot, product edits, split/merge, status rollup = UPDATE/DELETE) stay
-- admin/service-only. spine_lineage writes remain admin-only (split/merge run via
-- the admin/service client). Idempotent.

DROP POLICY IF EXISTS spines_write_admin ON public.spines;

DROP POLICY IF EXISTS spines_insert_authenticated ON public.spines;
CREATE POLICY spines_insert_authenticated ON public.spines
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS spines_update_admin ON public.spines;
CREATE POLICY spines_update_admin ON public.spines
  FOR UPDATE TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

DROP POLICY IF EXISTS spines_delete_admin ON public.spines;
CREATE POLICY spines_delete_admin ON public.spines
  FOR DELETE TO authenticated
  USING (public.is_current_user_platform_admin());
