DO $$
DECLARE v_def text; v_old text; v_new text;
BEGIN
  v_old := 'IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION ''FORBIDDEN''; END IF;';

  SELECT pg_get_functiondef('public.create_same_spine_project_leg(uuid,uuid,uuid,jsonb)'::regprocedure) INTO v_def;
  v_new := 'IF NOT (public.is_current_user_platform_admin() OR (' ||
    'p_seller_id IS NULL AND p_buyer_id IS NOT NULL AND public.current_user_in_org(p_buyer_id) ' ||
    'AND EXISTS (SELECT 1 FROM public.organisations WHERE id=p_buyer_id AND is_active AND is_trader) ' ||
    'AND EXISTS (SELECT 1 FROM public.orders WHERE id=p_source_order_id AND seller_organisation_id=p_buyer_id)' ||
    ')) THEN RAISE EXCEPTION ''FORBIDDEN''; END IF;';
  IF position(v_old IN v_def)=0 THEN RAISE EXCEPTION 'create_same_spine_project_leg permission anchor missing'; END IF;
  EXECUTE replace(v_def,v_old,v_new);

  SELECT pg_get_functiondef('public.get_spine_origin_allocation(uuid)'::regprocedure) INTO v_def;
  v_new := 'IF NOT (public.is_current_user_platform_admin() OR EXISTS (' ||
    'SELECT 1 FROM public.orders o JOIN public.organisations org ON org.id=o.seller_organisation_id ' ||
    'WHERE o.id=p_source_order_id AND org.is_active AND org.is_trader AND public.current_user_in_org(org.id)' ||
    ')) THEN RAISE EXCEPTION ''FORBIDDEN''; END IF;';
  IF position(v_old IN v_def)=0 THEN RAISE EXCEPTION 'get_spine_origin_allocation permission anchor missing'; END IF;
  EXECUTE replace(v_def,v_old,v_new);

  SELECT pg_get_functiondef('public.create_project_rfq(uuid,uuid[],timestamp with time zone)'::regprocedure) INTO v_def;
  v_new := 'IF NOT (public.is_current_user_platform_admin() OR EXISTS (' ||
    'SELECT 1 FROM public.orders o JOIN public.organisations org ON org.id=o.buyer_organisation_id ' ||
    'WHERE o.id=p_order_id AND o.seller_organisation_id IS NULL AND org.is_active AND org.is_trader ' ||
    'AND public.current_user_in_org(org.id)' ||
    ')) THEN RAISE EXCEPTION ''FORBIDDEN''; END IF;';
  IF position(v_old IN v_def)=0 THEN RAISE EXCEPTION 'create_project_rfq permission anchor missing'; END IF;
  EXECUTE replace(v_def,v_old,v_new);

  SELECT pg_get_functiondef('public.award_project_rfq(uuid,uuid)'::regprocedure) INTO v_def;
  v_new := 'IF NOT (public.is_current_user_platform_admin() OR EXISTS (' ||
    'SELECT 1 FROM public.project_rfqs r JOIN public.orders o ON o.id=r.order_id ' ||
    'JOIN public.organisations org ON org.id=o.buyer_organisation_id ' ||
    'WHERE r.id=p_rfq_id AND org.is_active AND org.is_trader AND public.current_user_in_org(org.id)' ||
    ')) THEN RAISE EXCEPTION ''FORBIDDEN''; END IF;';
  IF position(v_old IN v_def)=0 THEN RAISE EXCEPTION 'award_project_rfq permission anchor missing'; END IF;
  EXECUTE replace(v_def,v_old,v_new);
END;
$$;
