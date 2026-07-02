-- =============================================
-- E8 · Drop the TRANSITIONAL legacy.producer arm from can_access_deal_row.
--
-- ⚠️ ORDERING DEPENDENCY (prod cutover runbook):
--   This migration MUST be applied ONLY AFTER the E8 data migration
--   (apps/portal/scripts/e8-migrate-legacy-orders.mts) has split every 3-party
--   order into a bilateral buy leg. Sequence at cutover:
--     1) snapshot prod
--     2) apply schema migrations …001–…018
--     3) run e8-migrate-legacy-orders.mts --apply   (splits producers → buy legs)
--     4) THEN apply THIS migration                  (drops the legacy arm)
--     5) deploy + verify
--   Applying it before the split would strip producer-org logins of access to
--   their un-split 3-party orders.
--
-- Why it's safe after the split: a producer relationship is now its OWN buy-leg
-- deal (seller = producer). A producer-org user in the Producer group holds
-- visibility/deal/side.sell, so they retain access to that buy leg via the
-- side.sell arm below — the legacy.producer arm is no longer needed.
--
-- Signature is UNCHANGED (p_producer stays; every policy still passes 4 args) —
-- the function simply no longer grants access based on the producer slot.
-- Idempotent (CREATE OR REPLACE).
-- =============================================

-- FAIL-SAFE INTERLOCK: abort (changing nothing) if the bilateral split hasn't run
-- yet, so a premature bulk `supabase db push` cannot strip the arm before the data
-- script and lock producers out. The predicate MIRRORS the script's needsSplit
-- EXACTLY (producer set, not yet split, AND a valid bilateral seller+buyer) — so
-- genuine orphans-with-producer (missing a party, intentionally never split) do NOT
-- block the drop forever. Passes once e8-migrate-legacy-orders.mts --apply is done.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE producer_organisation_id IS NOT NULL
      AND upstream_deal_id IS NULL
      AND seller_organisation_id IS NOT NULL
      AND buyer_organisation_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'E8 split incomplete — run apps/portal/scripts/e8-migrate-legacy-orders.mts --apply BEFORE dropping the legacy.producer arm';
  END IF;
END $$;

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

  -- E8: the transitional legacy.producer arm has been removed. Producer access
  -- now comes from being the SELLER of the migrated buy leg (side.sell above).
  RETURN false;
END;
$$;
