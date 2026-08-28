DO $$
DECLARE v_def text; v_old text; v_new text;
BEGIN
  SELECT pg_get_functiondef('public.award_project_rfq(uuid,uuid)'::regprocedure) INTO v_def;
  v_old := 'SELECT 1 FROM public.project_rfqs r JOIN public.orders ord ON ord.id=r.order_id JOIN public.organisations org ON org.id=ord.buyer_organisation_id WHERE r.id=p_rfq_id';
  v_new := 'SELECT 1 FROM public.project_rfqs rfqrow JOIN public.orders ord ON ord.id=rfqrow.order_id JOIN public.organisations org ON org.id=ord.buyer_organisation_id WHERE rfqrow.id=p_rfq_id';
  IF position(v_old IN v_def)=0 THEN RAISE EXCEPTION 'award RFQ permission alias anchor missing'; END IF;
  EXECUTE replace(v_def,v_old,v_new);
END;
$$;
