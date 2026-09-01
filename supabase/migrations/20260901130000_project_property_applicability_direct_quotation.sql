-- Per-line basic-property applicability, atomic structured-save versions, and
-- an explicit administrator path for recording the assigned seller's quote.

DROP FUNCTION IF EXISTS public.update_project_spec_values_and_applicability(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,JSONB);
CREATE OR REPLACE FUNCTION public.update_project_spec_values_and_applicability(
  p_order_id UUID,p_line_id UUID,p_version TIMESTAMPTZ,p_basic_values JSONB,p_process_values JSONB,
  p_basic_states JSONB,p_process_states JSONB
) RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE committed_version TIMESTAMPTZ;
BEGIN
 IF p_basic_states IS NULL OR jsonb_typeof(p_basic_states)<>'array' OR jsonb_array_length(p_basic_states)>200
   OR EXISTS(SELECT key FROM (SELECT i->>'key' key,count(*) occurrences FROM jsonb_array_elements(p_basic_states) i GROUP BY i->>'key') x WHERE key IS NULL OR occurrences<>1)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_basic_states) i WHERE jsonb_typeof(i->'active')<>'boolean')
 THEN RAISE EXCEPTION 'INVALID_BASIC_STATES'; END IF;

 PERFORM public.update_project_specification_structured_values(p_order_id,p_line_id,p_version,p_basic_values,p_process_values);

 IF jsonb_array_length(p_basic_states)<>(SELECT jsonb_array_length(specification_fields) FROM public.order_line_items WHERE id=p_line_id)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements((SELECT specification_fields FROM public.order_line_items WHERE id=p_line_id)) f
     WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_basic_states) i WHERE i->>'key'=f->>'key'))
 THEN RAISE EXCEPTION 'INVALID_BASIC_KEYS'; END IF;

 UPDATE public.order_line_items target SET specification_fields=(
   SELECT jsonb_agg(f || jsonb_build_object('active',(i->>'active')::boolean) ORDER BY ord)
   FROM jsonb_array_elements(target.specification_fields) WITH ORDINALITY source(f,ord)
   JOIN jsonb_array_elements(p_basic_states) i ON i->>'key'=f->>'key'
 ) WHERE target.id=p_line_id AND target.order_id=p_order_id AND target.side='sell'
 RETURNING target.updated_at INTO committed_version;

 PERFORM public.update_project_specification_process_applicability(p_order_id,p_line_id,p_process_states);
 IF committed_version IS NULL THEN RAISE EXCEPTION 'LINE_NOT_EDITABLE'; END IF;
 RETURN committed_version;
END $$;
REVOKE ALL ON FUNCTION public.update_project_spec_values_and_applicability(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,JSONB,JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_project_spec_values_and_applicability(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,JSONB,JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.initialize_direct_project_quotation(p_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE leg public.orders%ROWTYPE; seller public.organisations%ROWTYPE; v_rfq_id UUID; v_candidate_id UUID; rfq_status TEXT;
BEGIN
 IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO leg FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LEG_NOT_FOUND'; END IF;
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

-- The normal award function is retained, except an already-assigned seller may
-- be awarded in place when it is the submitted candidate created above.
DO $$
DECLARE definition TEXT; changed TEXT;
BEGIN
 SELECT pg_get_functiondef('public.award_project_rfq(uuid,uuid)'::regprocedure) INTO definition;
 IF position('IF o.buyer_organisation_id IS NULL OR o.seller_organisation_id IS NOT NULL THEN RAISE EXCEPTION ''SELLER_PLACEHOLDER_REQUIRED''; END IF;' IN definition)>0 THEN
   definition:=replace(definition,
     'IF o.buyer_organisation_id IS NULL OR o.seller_organisation_id IS NOT NULL THEN RAISE EXCEPTION ''SELLER_PLACEHOLDER_REQUIRED''; END IF;',
     'IF o.buyer_organisation_id IS NULL OR (o.seller_organisation_id IS NOT NULL AND o.seller_organisation_id<>c.organization_id) THEN RAISE EXCEPTION ''SELLER_PLACEHOLDER_REQUIRED''; END IF;');
 ELSIF position('o.seller_organisation_id<>c.organization_id' IN definition)=0 THEN
   RAISE EXCEPTION 'award_project_rfq assigned-seller anchor missing';
 END IF;
 definition:=replace(definition,
   'IF o.seller_organisation_id IS NULL AND v_over THEN RAISE EXCEPTION ''WORK_PACKAGE_OVER_ALLOCATED''; END IF;',
   'IF v_over THEN RAISE EXCEPTION ''WORK_PACKAGE_OVER_ALLOCATED''; END IF;');
 IF position('AND d.id<>o.id' IN definition)=0 THEN
   changed:=replace(definition,
     'AND d.buyer_organisation_id IS NOT NULL AND d.seller_organisation_id IS NOT NULL',
     'AND d.buyer_organisation_id IS NOT NULL AND d.seller_organisation_id IS NOT NULL AND d.id<>o.id');
   IF changed=definition THEN RAISE EXCEPTION 'award_project_rfq allocation anchor missing'; END IF;
   definition:=changed;
 END IF;
 changed:=definition;
 EXECUTE changed;
END $$;

NOTIFY pgrst, 'reload schema';
