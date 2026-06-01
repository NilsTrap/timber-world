-- Fix: shipment RECEIVERS (and senders) can read the packages on a shipment
-- even while it is still pending ("on the way") and therefore still owned by
-- the SENDER organisation.
--
-- Background — the bug this repairs:
--   The RLS SELECT policy added in 20260522000005 grants visibility to a
--   package only via current_user_in_org(organisation_id). But a package on a
--   pending shipment still carries the SENDER's organisation_id; ownership only
--   flips to the receiver inside acceptShipment (acceptRejectShipment.ts). So a
--   receiver viewing an incoming "on the way" shipment saw 0 packages / 0 m3 in
--   both the list and the detail view, and could not inspect the contents
--   before deciding to Accept or Reject — defeating the Accept/Reject workflow.
--
-- The shipments policy (20260522000005) already lets a counterparty (from OR to
-- org) read the shipment row itself; this aligns the package-side policy with
-- that, so the package contents are visible to the same parties.
--
-- Safety / scope:
--   * Read-only change. INSERT/UPDATE/DELETE on inventory_packages are left
--     untouched and stay gated on organisation_id ownership, so a pending
--     receiver still cannot MODIFY packages before accepting.
--   * Rejected shipments are excluded (status IS DISTINCT FROM 'rejected', which
--     also treats a NULL status as "not rejected"), so a receiver who rejects a
--     shipment does not retain visibility into its packages afterward.
--   * The helper is STABLE SECURITY DEFINER (same pattern as the other RLS
--     helpers in 20260522000002) so it bypasses nested RLS on the shipments
--     table and the policy evaluator can cache it. The shipments policy does
--     NOT reference inventory_packages, so there is no policy recursion.
--   * Common case (a user reading their OWN inventory, organisation_id = their
--     org) short-circuits on the second predicate and never invokes the helper,
--     so there is no performance regression on the hot path. shipments.id is the
--     PK, so the helper's lookup is index-backed.
--
-- Coordinated with the RLS rollout owner; applied directly to the shared cloud
-- database per agreement.

-- ─── Helper: is the current user a counterparty on the package's shipment ──
CREATE OR REPLACE FUNCTION public.current_user_on_shipment_for_package(pkg_shipment_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pkg_shipment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM shipments s
    WHERE s.id = pkg_shipment_id
      AND s.status IS DISTINCT FROM 'rejected'
      AND (
        public.current_user_in_org(s.from_organisation_id)
        OR public.current_user_in_org(s.to_organisation_id)
      )
  )
$$;

COMMENT ON FUNCTION public.current_user_on_shipment_for_package IS
  'True if the current user is a member of the from- or to-organisation of the (non-rejected) shipment the package is currently on. Lets shipment counterparties read package contents while the shipment is pending and still owned by the sender, without granting write access.';

-- ─── Replace the inventory_packages SELECT policy ─────────────────────────
DROP POLICY IF EXISTS inventory_packages_select_authenticated ON public.inventory_packages;

CREATE POLICY inventory_packages_select_authenticated ON public.inventory_packages
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(organisation_id)
    OR public.current_user_on_shipment_for_package(shipment_id)
  );

COMMENT ON TABLE public.inventory_packages IS
  'RLS enabled 2026-05-22; SELECT widened 2026-06-01: authenticated users see packages they own (organisation_id) OR packages on a non-rejected shipment where they are the from/to counterparty (lets receivers inspect incoming shipments before accepting). Writes remain owner-only.';

-- ─── Rollback (manual; uncomment and run to revert) ───────────────────────
-- DROP POLICY IF EXISTS inventory_packages_select_authenticated ON public.inventory_packages;
-- CREATE POLICY inventory_packages_select_authenticated ON public.inventory_packages
--   FOR SELECT TO authenticated
--   USING (
--     public.is_current_user_platform_admin()
--     OR public.current_user_in_org(organisation_id)
--   );
-- DROP FUNCTION IF EXISTS public.current_user_on_shipment_for_package(UUID);
