-- Serialize mutations that attach or alter bilateral legs on one spine.
CREATE OR REPLACE FUNCTION public.lock_project_spine_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.spine_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.spine_id::text, 0));
    IF NEW.deal_kind = 'purchase_only'
      AND (TG_OP = 'INSERT' OR OLD.spine_id IS DISTINCT FROM NEW.spine_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.orders
        WHERE spine_id = NEW.spine_id
          AND id <> NEW.id
          AND seller_organisation_id = NEW.buyer_organisation_id
          AND lifecycle_stage <> 'cancelled'
      )
    THEN RAISE EXCEPTION 'Purchase leg has no adjacent upstream seller'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_project_spine_mutation ON public.orders;
CREATE TRIGGER trg_lock_project_spine_mutation
BEFORE INSERT OR UPDATE OF spine_id, buyer_organisation_id, seller_organisation_id
ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.lock_project_spine_mutation();

-- Correct one Draft leg's seller and keep its adjacent downstream buyer aligned.
-- Visible deal codes remain stable historical identifiers.
CREATE OR REPLACE FUNCTION public.correct_project_leg_seller(
  p_project_id UUID,
  p_seller_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_link public.orders%ROWTYPE;
  v_link_count INTEGER := 0;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'Platform admin only'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF v_order.spine_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_order.spine_id::text, 0));
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_project_id FOR UPDATE;
  IF v_order.lifecycle_stage <> 'draft' THEN RAISE EXCEPTION 'Seller can only be corrected while Draft'; END IF;
  IF p_seller_id = v_order.buyer_organisation_id THEN RAISE EXCEPTION 'Buyer and seller must differ'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = p_seller_id AND is_active AND (is_trader OR is_supplier OR is_producer)
  ) THEN RAISE EXCEPTION 'Invalid seller'; END IF;
  IF p_seller_id = v_order.seller_organisation_id THEN
    RETURN jsonb_build_object('dealCode', v_order.deal_code, 'linkedProjectId', NULL);
  END IF;

  IF v_order.spine_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.orders
      WHERE spine_id = v_order.spine_id
        AND id <> p_project_id
        AND lifecycle_stage <> 'cancelled'
        AND (buyer_organisation_id = p_seller_id OR seller_organisation_id = p_seller_id)
    ) THEN RAISE EXCEPTION 'Seller already belongs to this project spine'; END IF;

    -- upstream_deal_id is a legacy cache and is not populated consistently.
    -- Canonical adjacency is the next same-spine leg buying from this seller.
    SELECT count(*) INTO v_link_count
    FROM public.orders
    WHERE spine_id = v_order.spine_id
      AND buyer_organisation_id = v_order.seller_organisation_id
      AND id <> p_project_id
      AND lifecycle_stage <> 'cancelled';
    IF v_link_count > 1 THEN RAISE EXCEPTION 'Ambiguous downstream chain'; END IF;
    IF v_link_count = 1 THEN
      SELECT * INTO STRICT v_link FROM public.orders
      WHERE spine_id = v_order.spine_id
        AND buyer_organisation_id = v_order.seller_organisation_id
        AND id <> p_project_id
        AND lifecycle_stage <> 'cancelled'
      FOR UPDATE;
      IF v_link.lifecycle_stage <> 'draft' THEN RAISE EXCEPTION 'The linked project must be Draft'; END IF;
      IF v_link.seller_organisation_id = p_seller_id THEN RAISE EXCEPTION 'Correction would create a self-deal'; END IF;
      UPDATE public.orders
      SET buyer_organisation_id = p_seller_id, customer_organisation_id = p_seller_id
      WHERE id = v_link.id;
    END IF;
  END IF;

  UPDATE public.orders SET seller_organisation_id = p_seller_id WHERE id = p_project_id;
  RETURN jsonb_build_object(
    'dealCode', v_order.deal_code,
    'linkedProjectId', CASE WHEN v_link_count = 1 THEN v_link.id ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.correct_project_leg_seller(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_project_leg_seller(UUID,UUID) TO authenticated, service_role;
