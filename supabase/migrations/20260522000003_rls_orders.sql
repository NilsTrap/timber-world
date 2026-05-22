-- Row-Level Security on `orders`.
--
-- Multi-tenant rule: a user can see / modify an order iff they are
--   - a platform admin, OR
--   - a member of the customer org, seller org, or producer org on that row.
--
-- The previous state was no RLS at all (relrowsecurity = false) — every
-- authenticated user could read every row in `orders`. Server actions that
-- need to bypass RLS (admin tooling, cross-tenant ops) continue to use the
-- service-role client, which is unaffected by these policies.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Authenticated SELECT: platform admin OR membership in one of the three parties.
CREATE POLICY orders_select_authenticated ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(customer_organisation_id)
    OR public.current_user_in_org(seller_organisation_id)
    OR public.current_user_in_org(producer_organisation_id)
  );

-- Authenticated INSERT: the new row must reference at least one org the user
-- belongs to (or the user is a platform admin).
CREATE POLICY orders_insert_authenticated ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(customer_organisation_id)
    OR public.current_user_in_org(seller_organisation_id)
    OR public.current_user_in_org(producer_organisation_id)
  );

-- Authenticated UPDATE: must currently own the row AND the post-update row
-- must still be owned. Both USING and WITH CHECK use the same predicate.
CREATE POLICY orders_update_authenticated ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(customer_organisation_id)
    OR public.current_user_in_org(seller_organisation_id)
    OR public.current_user_in_org(producer_organisation_id)
  )
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(customer_organisation_id)
    OR public.current_user_in_org(seller_organisation_id)
    OR public.current_user_in_org(producer_organisation_id)
  );

-- Authenticated DELETE: same predicate as UPDATE-USING.
CREATE POLICY orders_delete_authenticated ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(customer_organisation_id)
    OR public.current_user_in_org(seller_organisation_id)
    OR public.current_user_in_org(producer_organisation_id)
  );

COMMENT ON TABLE public.orders IS
  'RLS enabled 2026-05-22: authenticated users see/modify only orders where they are a member of the customer/seller/producer org, or platform admins.';
