CREATE OR REPLACE FUNCTION public.ensure_project_origin_spine(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_spine_id uuid;
  v_spine_code text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF NOT (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(v_order.buyer_organisation_id)
    OR public.current_user_in_org(v_order.seller_organisation_id)
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_order.spine_id IS NOT NULL THEN RETURN v_order.spine_id; END IF;

  v_spine_id := gen_random_uuid();
  v_spine_code := 'SP-' || lpad(public.next_counter('spine')::text, 3, '0');
  INSERT INTO public.spines(id, code, title, product_group, created_by)
  VALUES(v_spine_id, v_spine_code, v_order.name, v_order.product_group, public.current_portal_user_id());
  UPDATE public.orders SET spine_id = v_spine_id WHERE id = p_order_id;
  RETURN v_spine_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_project_origin_spine(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_project_origin_spine(uuid) TO authenticated;
