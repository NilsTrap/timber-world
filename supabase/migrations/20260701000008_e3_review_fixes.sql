-- E3 review fixes:
-- (a) Recompute the spine rollup when a deal is DELETED — trg_orders_spine_cache
--     fires only on INSERT/UPDATE, so deleting a deal from a spine left the cache stale.
-- (b) Bind gate-confirmation inserts to the actor's ACTUAL party on the deal — the
--     previous policy let any party of the deal record any party's sign-off (a buyer
--     could forge the seller's sign-off and clear a bilateral gate). Idempotent.

-- (a) DELETE → recompute the (former) spine's rollup
CREATE OR REPLACE FUNCTION public.trg_orders_spine_cache_del()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.spine_id IS NOT NULL THEN
    PERFORM public.recompute_spine_rollup(OLD.spine_id);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_spine_cache_del ON public.orders;
CREATE TRIGGER trg_orders_spine_cache_del
  AFTER DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_spine_cache_del();

-- (b) party-bound confirmation insert: seller sign-off only by the seller org, buyer
--     sign-off / acceptance only by the buyer org (admins bypass).
DROP POLICY IF EXISTS deal_gate_conf_insert ON public.deal_gate_confirmations;
CREATE POLICY deal_gate_conf_insert ON public.deal_gate_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_user_platform_admin() OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = deal_gate_confirmations.order_id AND (
        (deal_gate_confirmations.block_type = 'party_signoff'
           AND deal_gate_confirmations.block_key = 'seller'
           AND public.current_user_in_org(o.seller_organisation_id)) OR
        (deal_gate_confirmations.block_type = 'party_signoff'
           AND deal_gate_confirmations.block_key = 'buyer'
           AND public.current_user_in_org(o.buyer_organisation_id)) OR
        (deal_gate_confirmations.block_type = 'acceptance'
           AND public.current_user_in_org(o.buyer_organisation_id))
      )));
