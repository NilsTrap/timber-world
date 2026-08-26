-- Atomic Draft party corrections for the Projects commercial header.
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_active_outgoing_leg_per_spine_buyer
  ON public.orders (spine_id, buyer_organisation_id)
  WHERE spine_id IS NOT NULL AND buyer_organisation_id IS NOT NULL AND lifecycle_stage <> 'cancelled';

CREATE OR REPLACE FUNCTION public.correct_project_parties(
  p_project_id UUID,
  p_buyer_id UUID DEFAULT NULL,
  p_trader_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_link public.orders%ROWTYPE;
  v_link_count INTEGER := 0;
  v_seller_code TEXT;
  v_buyer_code TEXT;
  v_code TEXT;
  v_link_code TEXT;
BEGIN
  IF (p_buyer_id IS NULL) = (p_trader_id IS NULL) THEN RAISE EXCEPTION 'Exactly one party correction is required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND OR v_order.deal_kind = 'purchase_only' THEN RAISE EXCEPTION 'Root project not found'; END IF;
  IF v_order.lifecycle_stage <> 'draft' THEN RAISE EXCEPTION 'Parties can only be corrected while Draft'; END IF;

  IF p_buyer_id IS NOT NULL THEN
    IF p_buyer_id = v_order.buyer_organisation_id THEN
      RETURN jsonb_build_object('dealCode',v_order.deal_code,'linkedProjectId',NULL);
    END IF;
    IF NOT (public.is_current_user_platform_admin() OR (
      public.current_user_in_org(v_order.seller_organisation_id)
      AND public.current_user_has_right(v_order.seller_organisation_id, 'action', 'deal', 'create')
      AND public.current_user_has_right(v_order.seller_organisation_id, 'visibility', 'deal_fields', 'customer_identity')
    )) THEN RAISE EXCEPTION 'Not allowed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id=v_order.seller_organisation_id AND is_active AND is_trader) THEN RAISE EXCEPTION 'Represented seller is not an active trader'; END IF;
    IF p_buyer_id = v_order.seller_organisation_id THEN RAISE EXCEPTION 'Buyer and seller must differ'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id=p_buyer_id AND is_active AND is_customer) THEN RAISE EXCEPTION 'Invalid buyer'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.organisation_trading_partners WHERE organisation_id=v_order.seller_organisation_id AND partner_organisation_id=p_buyer_id) THEN RAISE EXCEPTION 'Buyer is not a trading partner'; END IF;
    UPDATE public.orders SET buyer_organisation_id=p_buyer_id, customer_organisation_id=p_buyer_id WHERE id=p_project_id;
  ELSE
    IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'Platform admin only'; END IF;
    IF p_trader_id = v_order.buyer_organisation_id THEN RAISE EXCEPTION 'Buyer and seller must differ'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id=p_trader_id AND is_active AND is_trader) THEN RAISE EXCEPTION 'Invalid trader'; END IF;
    IF v_order.spine_id IS NOT NULL THEN
      SELECT count(*) INTO v_link_count FROM public.orders WHERE spine_id=v_order.spine_id AND buyer_organisation_id=v_order.seller_organisation_id AND id<>p_project_id AND lifecycle_stage<>'cancelled';
      IF v_link_count > 1 THEN RAISE EXCEPTION 'Ambiguous downstream chain'; END IF;
      IF v_link_count = 1 THEN
        SELECT * INTO v_link FROM public.orders WHERE spine_id=v_order.spine_id AND buyer_organisation_id=v_order.seller_organisation_id AND id<>p_project_id AND lifecycle_stage<>'cancelled' FOR UPDATE;
        IF v_link.lifecycle_stage <> 'draft' THEN RAISE EXCEPTION 'The linked project must be Draft'; END IF;
        IF v_link.seller_organisation_id = p_trader_id THEN RAISE EXCEPTION 'Correction would create a self-deal'; END IF;
        UPDATE public.orders SET buyer_organisation_id=p_trader_id, customer_organisation_id=p_trader_id WHERE id=v_link.id;
      END IF;
    END IF;
    UPDATE public.orders SET seller_organisation_id=p_trader_id WHERE id=p_project_id;
  END IF;

  SELECT substr(regexp_replace(upper(coalesce(s.code,'TIM')),'[^A-Z0-9]','','g'),1,3), substr(regexp_replace(upper(coalesce(b.code,'XXX')),'[^A-Z0-9]','','g'),1,3)
    INTO v_seller_code, v_buyer_code FROM public.orders o LEFT JOIN public.organisations s ON s.id=o.seller_organisation_id LEFT JOIN public.organisations b ON b.id=o.buyer_organisation_id WHERE o.id=p_project_id;
  v_seller_code := coalesce(nullif(v_seller_code,''),'TIM'); v_buyer_code := coalesce(nullif(v_buyer_code,''),'XXX');
  v_code := v_seller_code||'-'||v_buyer_code||'-'||lpad(public.next_counter('deal:'||v_seller_code||':'||v_buyer_code)::text,3,'0');
  UPDATE public.orders SET deal_code=v_code WHERE id=p_project_id;

  IF v_link_count = 1 THEN
    SELECT substr(regexp_replace(upper(coalesce(s.code,'TIM')),'[^A-Z0-9]','','g'),1,3), substr(regexp_replace(upper(coalesce(b.code,'XXX')),'[^A-Z0-9]','','g'),1,3)
      INTO v_seller_code, v_buyer_code FROM public.orders o LEFT JOIN public.organisations s ON s.id=o.seller_organisation_id LEFT JOIN public.organisations b ON b.id=o.buyer_organisation_id WHERE o.id=v_link.id;
    v_seller_code := coalesce(nullif(v_seller_code,''),'TIM'); v_buyer_code := coalesce(nullif(v_buyer_code,''),'XXX');
    v_link_code := v_seller_code||'-'||v_buyer_code||'-'||lpad(public.next_counter('deal:'||v_seller_code||':'||v_buyer_code)::text,3,'0');
    UPDATE public.orders SET deal_code=v_link_code WHERE id=v_link.id;
  END IF;
  RETURN jsonb_build_object('dealCode',v_code,'linkedProjectId',CASE WHEN v_link_count=1 THEN v_link.id ELSE NULL END);
END;
$$;

REVOKE ALL ON FUNCTION public.correct_project_parties(UUID,UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_project_parties(UUID,UUID,UUID) TO authenticated, service_role;
