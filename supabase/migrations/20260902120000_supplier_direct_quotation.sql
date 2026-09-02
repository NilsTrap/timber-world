-- Assigned suppliers may initialize their own quotation. Candidate ownership
-- and subsequent writes remain bound to the authenticated organisation.
CREATE OR REPLACE FUNCTION public.initialize_direct_project_quotation(p_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE leg public.orders%ROWTYPE; seller public.organisations%ROWTYPE; v_rfq_id UUID; v_candidate_id UUID; rfq_status TEXT;
BEGIN
 SELECT * INTO leg FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LEG_NOT_FOUND'; END IF;
 IF NOT (public.is_current_user_platform_admin() OR public.current_user_in_org(leg.seller_organisation_id)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF leg.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'LEG_NOT_FOUND'; END IF;
 IF leg.buyer_organisation_id IS NULL OR leg.seller_organisation_id IS NULL THEN RAISE EXCEPTION 'ASSIGNED_SELLER_REQUIRED'; END IF;
 IF leg.buyer_organisation_id=leg.seller_organisation_id THEN RAISE EXCEPTION 'SELF_DEAL'; END IF;
 SELECT * INTO seller FROM public.organisations WHERE id=leg.seller_organisation_id;
 IF NOT FOUND OR NOT seller.is_active OR NOT (seller.is_supplier OR seller.is_producer OR seller.is_trader OR seller.is_manufacturer)
 THEN RAISE EXCEPTION 'SELLER_INELIGIBLE'; END IF;

 SELECT id,status INTO v_rfq_id,rfq_status FROM public.project_rfqs WHERE order_id=leg.id ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF v_rfq_id IS NOT NULL THEN
   SELECT id INTO v_candidate_id FROM public.project_rfq_candidates WHERE rfq_id=v_rfq_id AND organization_id=leg.seller_organisation_id ORDER BY created_at DESC,id DESC LIMIT 1;
   IF v_candidate_id IS NOT NULL AND rfq_status IN ('open','awarded') THEN RETURN jsonb_build_object('rfqId',v_rfq_id,'candidateId',v_candidate_id); END IF;
   IF rfq_status='open' THEN RAISE EXCEPTION 'COMPETITIVE_RFQ_ALREADY_OPEN'; END IF;
   IF rfq_status='awarded' THEN RAISE EXCEPTION 'LEG_ALREADY_AWARDED'; END IF;
 END IF;
 INSERT INTO public.project_rfqs(organization_id,order_id,deadline,created_by)
 VALUES(leg.buyer_organisation_id,leg.id,now()+interval '1 year',public.current_portal_user_id()) RETURNING id INTO v_rfq_id;
 INSERT INTO public.project_rfq_candidates(organization_id,rfq_id) VALUES(leg.seller_organisation_id,v_rfq_id) RETURNING id INTO v_candidate_id;
 RETURN jsonb_build_object('rfqId',v_rfq_id,'candidateId',v_candidate_id);
END $$;
REVOKE ALL ON FUNCTION public.initialize_direct_project_quotation(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.initialize_direct_project_quotation(UUID) TO authenticated;
