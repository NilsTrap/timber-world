-- 20260601000002_rls_organisations_shared_context.sql
--
-- Widen the organisations SELECT policy so a logged-in user can read the row
-- of ANOTHER organisation they share a supply-chain relationship with:
--   * shipment counterparty   (from_organisation_id / to_organisation_id)
--   * order party             (customer / seller / producer organisation_id)
--   * trading partner         (organisation_trading_partners, either direction)
--
-- Fixes: blank "From: -" sender name on incoming shipments, the empty external
-- trading-partner dropdown, and the empty Customer/Manufacturer order
-- dropdowns — all caused by the 2026-05-22 RLS rollout (20260522000007)
-- restricting organisations reads to own-org + platform admin.
--
-- Safety / recursion: the helper is STABLE SECURITY DEFINER, so its subqueries
-- bypass RLS on shipments / orders / organisation_trading_partners. None of
-- those tables' policies query organisations, so there is no policy recursion
-- (same pattern as current_user_on_shipment_for_package in 20260601000001).
--
-- Perf: reading your OWN org short-circuits on current_user_in_org(id) and
-- never invokes the helper. The helper's lookups are index-backed:
--   shipments    -> idx_shipments_from / idx_shipments_to (+ (org,status) idx)
--   orders       -> idx_orders_customer/seller/producer_status (20260522000001)
--   trading ptrs -> idx_trading_partners_org / idx_trading_partners_partner
--
-- Note on sensitive columns: organisations carries bank/vat/contact columns and
-- PostgREST embedded joins have no column-level RLS, so a related counterparty
-- can now read those columns. This is strictly TIGHTER than the pre-2026-05-22
-- baseline (no RLS at all → every authenticated user read every org row) and is
-- a legitimate need (CMR + Packing List PDFs require the counterparty's VAT /
-- legal address). If the business later wants bank/VAT hidden from partners, the
-- follow-up is a column-restricted view (id/code/name/is_external/logo_url) that
-- cross-org joins embed instead of the base table.
--
-- This migration ONLY drops/recreates the named policy organisations_select.
-- It does NOT touch organisations_anon_marketing_read (the anon-role marketing
-- read policy added directly to cloud on 2026-05-27) or organisations_admin_write.

-- ─── Helper: does the current user share a supply-chain context with org_id ──
CREATE OR REPLACE FUNCTION public.current_user_shares_context_with_org(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id IS NOT NULL AND (
    -- (a) Shipment counterparty: org_id is one side, user is a member of the other.
    EXISTS (
      SELECT 1 FROM shipments s
      WHERE (
              s.from_organisation_id = org_id
              AND public.current_user_in_org(s.to_organisation_id)
            )
         OR (
              s.to_organisation_id = org_id
              AND public.current_user_in_org(s.from_organisation_id)
            )
    )
    -- (b) Order party: org_id is one of the three parties and the user is a
    --     member of any of the three parties on that order.
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE (
              o.customer_organisation_id = org_id
              OR o.seller_organisation_id = org_id
              OR o.producer_organisation_id = org_id
            )
        AND (
              public.current_user_in_org(o.customer_organisation_id)
              OR public.current_user_in_org(o.seller_organisation_id)
              OR public.current_user_in_org(o.producer_organisation_id)
            )
    )
    -- (c) Trading partner, EITHER direction.
    OR EXISTS (
      SELECT 1 FROM organisation_trading_partners tp
      WHERE (
              tp.partner_organisation_id = org_id
              AND public.current_user_in_org(tp.organisation_id)
            )
         OR (
              tp.organisation_id = org_id
              AND public.current_user_in_org(tp.partner_organisation_id)
            )
    )
  )
$$;

COMMENT ON FUNCTION public.current_user_shares_context_with_org IS
  'True if the current user belongs to an organisation related to org_id via a shipment (from/to counterparty), an order (customer/seller/producer party), or an organisation_trading_partners link (either direction). STABLE SECURITY DEFINER so the subqueries bypass nested RLS; used to let users read counterparty/partner organisation rows without exposing unrelated orgs.';

-- ─── Replace the organisations SELECT policy (add the shared-context arm) ────
DROP POLICY IF EXISTS organisations_select ON public.organisations;

CREATE POLICY organisations_select ON public.organisations
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(id)
    OR public.current_user_shares_context_with_org(id)
  );

COMMENT ON TABLE public.organisations IS
  'RLS enabled 2026-05-22; SELECT widened 2026-06-01: authenticated users read their own org, orgs they share a shipment/order/trading-partner relationship with, or all orgs if platform admin. Write platform admin only. Separate anon-role policy organisations_anon_marketing_read governs public marketing reads.';

-- ─── Rollback (manual; uncomment and run to revert to the original two-arm policy) ──
-- DROP POLICY IF EXISTS organisations_select ON public.organisations;
-- CREATE POLICY organisations_select ON public.organisations
--   FOR SELECT TO authenticated
--   USING (
--     public.is_current_user_platform_admin()
--     OR public.current_user_in_org(id)
--   );
-- DROP FUNCTION IF EXISTS public.current_user_shares_context_with_org(UUID);
-- -- NOTE: leave organisations_anon_marketing_read untouched on rollback.
