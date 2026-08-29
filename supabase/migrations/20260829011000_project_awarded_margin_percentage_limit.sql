-- Match the approved UI/business limit: gross margin percentage is 0–99.99.
CREATE OR REPLACE FUNCTION public.set_project_awarded_margin(
  p_order_id UUID,
  p_mode TEXT,
  p_value NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_cost BIGINT;
  v_margin BIGINT;
  v_sales BIGINT;
  v_percent NUMERIC(7,4);
BEGIN
  IF p_mode NOT IN ('amount','percentage') OR p_value IS NULL OR p_value < 0 THEN
    RAISE EXCEPTION 'MARGIN_INVALID';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF NOT (
    public.is_current_user_platform_admin()
    OR (
      v_order.buyer_organisation_id IS NOT NULL
      AND public.current_user_in_org(v_order.buyer_organisation_id)
      AND EXISTS (
        SELECT 1 FROM public.organisations org
        WHERE org.id = v_order.buyer_organisation_id AND org.is_active AND org.is_trader
      )
    )
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT candidate.quote_total_cents INTO v_cost
  FROM public.project_rfqs rfq
  JOIN public.project_rfq_candidates candidate
    ON candidate.id = rfq.awarded_candidate_id
   AND candidate.rfq_id = rfq.id
   AND candidate.status = 'awarded'
  WHERE rfq.order_id = p_order_id AND rfq.status = 'awarded'
  ORDER BY rfq.created_at DESC
  LIMIT 1;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'AWARDED_QUOTATION_REQUIRED'; END IF;

  IF p_mode = 'percentage' THEN
    IF p_value > 99.99 THEN RAISE EXCEPTION 'MARGIN_PERCENT_INVALID'; END IF;
    v_sales := round(v_cost::NUMERIC / (1 - p_value / 100))::BIGINT;
    v_margin := v_sales - v_cost;
  ELSE
    IF p_value > 9223372036854775807 - v_cost THEN RAISE EXCEPTION 'MARGIN_TOO_LARGE'; END IF;
    v_margin := round(p_value)::BIGINT;
    v_sales := v_cost + v_margin;
  END IF;

  v_percent := CASE WHEN v_sales = 0 THEN 0
    ELSE round((v_margin::NUMERIC / v_sales::NUMERIC) * 100, 4) END;

  UPDATE public.orders SET
    margin_amount_cents = v_margin,
    margin_percent = v_percent,
    resale_value_cents = v_sales,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'purchaseCostCents', v_cost,
    'marginAmountCents', v_margin,
    'marginPercent', v_percent,
    'salesAmountCents', v_sales
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_awarded_margin(UUID,TEXT,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_project_awarded_margin(UUID,TEXT,NUMERIC) TO authenticated;
