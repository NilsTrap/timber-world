-- =============================================
-- E4 · Deal-isolation RLS rewrite — bilateral seller+buyer, group/direction-aware
-- Migration: 20260701000010_access_rls_rewrite.sql
--
-- Replaces the 3-party predicate (customer/seller/producer org membership)
-- everywhere it lives with ONE master predicate, can_access_deal_row():
--
--   platform admin
--   OR (member of seller org AND group grants visibility/deal/side.sell AND scope ok)
--   OR (member of buyer  org AND group grants visibility/deal/side.buy  AND scope ok)
--   OR (member of producer org AND group grants visibility/deal/legacy.producer)  -- TRANSITIONAL
--
-- Direction-awareness is what hides the middle leg from the house's own
-- staff: both legs of a chain belong to the house org, so membership alone
-- can never wall a Salesperson off the buy leg — the group right does.
-- The legacy.producer arm keeps producer-org logins working on the 69
-- un-migrated 3-party orders; it is removed in E8 with the data migration.
--
-- Also closes two pre-existing holes: order_files and order_activity_log
-- (and the 'orders' storage bucket) had USING(true) policies — any
-- authenticated user could read any order's files/log.
-- =============================================

-- 1. Rights helpers (same family as 20260522000002; SECURITY DEFINER so
--    they read the rights tables without policy recursion) ---------------

CREATE OR REPLACE FUNCTION public.current_user_has_right(
  p_org UUID, p_type TEXT, p_resource TEXT, p_key TEXT
) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p_org IS NOT NULL AND EXISTS (
    SELECT 1
    FROM user_access_groups uag
    JOIN portal_users pu ON pu.id = uag.user_id
    JOIN access_group_rights r ON r.group_id = uag.group_id
    WHERE pu.auth_user_id = auth.uid()
      AND uag.organization_id = p_org
      AND r.right_type = p_type
      AND r.resource = p_resource
      AND r.key = p_key
  ), false)
$$;

-- Same right in ANY org the caller is assigned groups for (used where the
-- row has no org anchor, e.g. spine INSERT during deal creation).
CREATE OR REPLACE FUNCTION public.current_user_has_right_any_org(
  p_type TEXT, p_resource TEXT, p_key TEXT
) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM user_access_groups uag
    JOIN portal_users pu ON pu.id = uag.user_id
    JOIN access_group_rights r ON r.group_id = uag.group_id
    WHERE pu.auth_user_id = auth.uid()
      AND r.right_type = p_type
      AND r.resource = p_resource
      AND r.key = p_key
  ), false)
$$;

-- Widest deal scope across the caller's groups in an org: all > company > mine.
-- No scope right at all → 'company' (legacy-parity default).
CREATE OR REPLACE FUNCTION public.current_user_deal_scope(p_org UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE COALESCE((
    SELECT max(CASE r.value #>> '{}'
                 WHEN 'all' THEN 3 WHEN 'company' THEN 2 WHEN 'mine' THEN 1 ELSE 0 END)
    FROM user_access_groups uag
    JOIN portal_users pu ON pu.id = uag.user_id
    JOIN access_group_rights r ON r.group_id = uag.group_id
    WHERE pu.auth_user_id = auth.uid()
      AND uag.organization_id = p_org
      AND r.right_type = 'scope' AND r.resource = 'deal' AND r.key = 'deals'
  ), 2)
    WHEN 3 THEN 'all' WHEN 1 THEN 'mine' ELSE 'company' END
$$;

-- The master deal predicate.
CREATE OR REPLACE FUNCTION public.can_access_deal_row(
  p_seller UUID, p_buyer UUID, p_producer UUID, p_created_by UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope TEXT;
BEGIN
  IF public.is_current_user_platform_admin() THEN
    RETURN true;
  END IF;

  IF p_seller IS NOT NULL
     AND public.current_user_in_org(p_seller)
     AND public.current_user_has_right(p_seller, 'visibility', 'deal', 'side.sell') THEN
    v_scope := public.current_user_deal_scope(p_seller);
    IF v_scope <> 'mine'
       OR (p_created_by IS NOT NULL AND p_created_by = public.current_portal_user_id()) THEN
      RETURN true;
    END IF;
  END IF;

  IF p_buyer IS NOT NULL
     AND public.current_user_in_org(p_buyer)
     AND public.current_user_has_right(p_buyer, 'visibility', 'deal', 'side.buy') THEN
    v_scope := public.current_user_deal_scope(p_buyer);
    IF v_scope <> 'mine'
       OR (p_created_by IS NOT NULL AND p_created_by = public.current_portal_user_id()) THEN
      RETURN true;
    END IF;
  END IF;

  -- TRANSITIONAL (remove in E8): legacy third-party slot for un-migrated orders.
  IF p_producer IS NOT NULL
     AND public.current_user_in_org(p_producer)
     AND public.current_user_has_right(p_producer, 'visibility', 'deal', 'legacy.producer') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_right(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_has_right_any_org(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_deal_scope(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_deal_row(UUID, UUID, UUID, UUID) TO authenticated, service_role;

-- 2. orders — the four symmetric policies go bilateral ---------------------

DROP POLICY IF EXISTS orders_select_authenticated ON public.orders;
CREATE POLICY orders_select_authenticated ON public.orders
  FOR SELECT TO authenticated
  USING (public.can_access_deal_row(
    seller_organisation_id, buyer_organisation_id, producer_organisation_id, created_by));

DROP POLICY IF EXISTS orders_insert_authenticated ON public.orders;
CREATE POLICY orders_insert_authenticated ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_deal_row(
    seller_organisation_id, buyer_organisation_id, producer_organisation_id, created_by));

DROP POLICY IF EXISTS orders_update_authenticated ON public.orders;
CREATE POLICY orders_update_authenticated ON public.orders
  FOR UPDATE TO authenticated
  USING (public.can_access_deal_row(
    seller_organisation_id, buyer_organisation_id, producer_organisation_id, created_by))
  WITH CHECK (public.can_access_deal_row(
    seller_organisation_id, buyer_organisation_id, producer_organisation_id, created_by));

DROP POLICY IF EXISTS orders_delete_authenticated ON public.orders;
CREATE POLICY orders_delete_authenticated ON public.orders
  FOR DELETE TO authenticated
  USING (public.can_access_deal_row(
    seller_organisation_id, buyer_organisation_id, producer_organisation_id, created_by));

-- Composite index for the buyer arm (customer/producer composites from
-- 20260522000001 stay for the transitional arm).
CREATE INDEX IF NOT EXISTS idx_orders_buyer_org_status
  ON public.orders(buyer_organisation_id, status)
  WHERE buyer_organisation_id IS NOT NULL;

-- 3. can_access_order — single choke-point for order children --------------
-- (order_line_items / order_external_refs / order_documents policies call it;
-- they need no change themselves.)

CREATE OR REPLACE FUNCTION public.can_access_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = p_order_id
      AND public.can_access_deal_row(
        o.seller_organisation_id, o.buyer_organisation_id,
        o.producer_organisation_id, o.created_by)
  )
$$;

-- 4. Close the order_files / order_activity_log holes ----------------------

DROP POLICY IF EXISTS "Authenticated users can manage order files" ON public.order_files;
CREATE POLICY order_files_rw ON public.order_files
  FOR ALL TO authenticated
  USING (public.can_access_order(order_id))
  WITH CHECK (public.can_access_order(order_id));

DROP POLICY IF EXISTS "Authenticated users can read order activity log" ON public.order_activity_log;
CREATE POLICY order_activity_log_select ON public.order_activity_log
  FOR SELECT TO authenticated
  USING (public.can_access_order(order_id));

DROP POLICY IF EXISTS "Authenticated users can insert order activity log" ON public.order_activity_log;
CREATE POLICY order_activity_log_insert ON public.order_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_order(order_id));


-- Safe path→order accessor for storage policies: non-UUID-prefixed legacy
-- object names fall back to platform-admin-only instead of a cast error.
CREATE OR REPLACE FUNCTION public.order_path_accessible(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.can_access_order((split_part(p_name, '/', 1))::uuid)
    ELSE public.is_current_user_platform_admin()
  END
$$;

GRANT EXECUTE ON FUNCTION public.order_path_accessible(TEXT) TO authenticated, service_role;

-- Storage: object names are '<order_id>/<category>/<uuid>_<file>' (see
-- uploadOrderFile.ts), so the order wall applies to the bucket too.
DROP POLICY IF EXISTS "Authenticated read for orders bucket" ON storage.objects;
CREATE POLICY "Order-walled read for orders bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'orders'
         AND public.order_path_accessible(name));

DROP POLICY IF EXISTS "Authenticated upload for orders bucket" ON storage.objects;
CREATE POLICY "Order-walled upload for orders bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'orders'
              AND public.order_path_accessible(name));

DROP POLICY IF EXISTS "Authenticated update for orders bucket" ON storage.objects;
CREATE POLICY "Order-walled update for orders bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'orders'
         AND public.order_path_accessible(name));

DROP POLICY IF EXISTS "Authenticated delete for orders bucket" ON storage.objects;
CREATE POLICY "Order-walled delete for orders bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'orders'
         AND public.order_path_accessible(name));

-- 5. spines / spine_lineage — bilateral + spine.status right ---------------
-- Spec §6.2: ordinary users see only their own deal's stage; the spine
-- overview is for the owner. Non-admins additionally need the
-- visibility/deal/spine.status right in a party org of a member deal.

DROP POLICY IF EXISTS spines_select_authenticated ON public.spines;
CREATE POLICY spines_select_authenticated ON public.spines
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.spine_id = spines.id
        AND public.can_access_deal_row(
          o.seller_organisation_id, o.buyer_organisation_id,
          o.producer_organisation_id, o.created_by)
        AND (public.current_user_has_right(o.seller_organisation_id, 'visibility', 'deal', 'spine.status')
          OR public.current_user_has_right(o.buyer_organisation_id, 'visibility', 'deal', 'spine.status'))
    )
  );

DROP POLICY IF EXISTS spine_lineage_select_authenticated ON public.spine_lineage;
CREATE POLICY spine_lineage_select_authenticated ON public.spine_lineage
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE (o.spine_id = spine_lineage.spine_id OR o.spine_id = spine_lineage.related_spine_id)
        AND public.can_access_deal_row(
          o.seller_organisation_id, o.buyer_organisation_id,
          o.producer_organisation_id, o.created_by)
        AND (public.current_user_has_right(o.seller_organisation_id, 'visibility', 'deal', 'spine.status')
          OR public.current_user_has_right(o.buyer_organisation_id, 'visibility', 'deal', 'spine.status'))
    )
  );

-- Spine seeding by portal deal-creators (resolves the TODO deferred in
-- 20260701000004): INSERT allowed for holders of action/deal/create, with
-- created_by pinned to the caller (no forged attribution / SP-squatting by
-- arbitrary users).
DROP POLICY IF EXISTS spines_insert_deal_creators ON public.spines;
CREATE POLICY spines_insert_deal_creators ON public.spines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_right_any_org('action', 'deal', 'create')
    AND created_by = public.current_portal_user_id()
  );

-- 6. deal_gate_confirmations SELECT — drop the customer/producer arms ------
-- (INSERT stays the party-bound policy from 20260701000008.)

DROP POLICY IF EXISTS deal_gate_conf_select ON public.deal_gate_confirmations;
CREATE POLICY deal_gate_conf_select ON public.deal_gate_confirmations
  FOR SELECT TO authenticated
  USING (public.can_access_order(order_id));

-- 7. organisations shared-context — direction- and book-aware --------------
-- Arm (b) now grants org-row visibility only through deals the caller can
-- actually access (a Salesperson stops seeing supplier orgs via raw reads).
-- Arm (c) forward direction (house user → partner org) is walled by address
-- book: client records need action/counterparty/clients, supplier records
-- (is_supplier OR is_producer) need action/counterparty/suppliers. The
-- reverse direction (partner-org user → the org that listed them) stays
-- open so a fresh counterparty login can see the house before any deal.

CREATE OR REPLACE FUNCTION public.current_user_shares_context_with_org(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM shipments s
      WHERE ( s.from_organisation_id = org_id AND public.current_user_in_org(s.to_organisation_id) )
         OR ( s.to_organisation_id   = org_id AND public.current_user_in_org(s.from_organisation_id) )
    )
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE ( o.customer_organisation_id = org_id
              OR o.seller_organisation_id = org_id
              OR o.buyer_organisation_id = org_id
              OR o.producer_organisation_id = org_id )
        AND public.can_access_deal_row(
          o.seller_organisation_id, o.buyer_organisation_id,
          o.producer_organisation_id, o.created_by)
    )
    OR EXISTS (
      SELECT 1
      FROM organisation_trading_partners tp
      JOIN organisations og ON og.id = org_id
      WHERE tp.partner_organisation_id = org_id
        AND public.current_user_in_org(tp.organisation_id)
        AND (
          (og.is_customer
             AND public.current_user_has_right(tp.organisation_id, 'action', 'counterparty', 'clients'))
          OR ((og.is_supplier OR og.is_producer)
             AND public.current_user_has_right(tp.organisation_id, 'action', 'counterparty', 'suppliers'))
        )
    )
    OR EXISTS (
      -- Reverse direction: a counterparty login sees the (internal/house)
      -- org that listed them, even before any deal exists. Restricted to
      -- internal targets: partner links are written symmetrically, so an
      -- unrestricted reverse arm would hand house staff every partner org
      -- and defeat the book wall above.
      SELECT 1
      FROM organisation_trading_partners tp
      JOIN organisations ho ON ho.id = org_id
      WHERE tp.organisation_id = org_id
        AND ho.is_external = false
        AND public.current_user_in_org(tp.partner_organisation_id)
    )
  )
$$;
