-- Explicit itemized or whole-project quotation pricing.
REVOKE ALL ON FUNCTION public.submit_project_rfq_quote_entries(UUID,JSONB,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.correct_project_rfq_quote_entries(UUID,JSONB,TEXT) FROM PUBLIC,anon,authenticated;
DROP FUNCTION IF EXISTS public.submit_project_rfq_quote_entries(UUID,JSONB,TEXT);
DROP FUNCTION IF EXISTS public.correct_project_rfq_quote_entries(UUID,JSONB,TEXT);

ALTER TABLE public.project_rfq_candidates ADD COLUMN IF NOT EXISTS pricing_mode TEXT;
ALTER TABLE public.project_rfq_candidates DROP CONSTRAINT IF EXISTS project_rfq_candidates_pricing_mode_check;
ALTER TABLE public.project_rfq_candidates ADD CONSTRAINT project_rfq_candidates_pricing_mode_check
  CHECK (pricing_mode IS NULL OR pricing_mode IN ('itemized','total'));
ALTER TABLE public.project_rfq_candidates DROP CONSTRAINT IF EXISTS project_rfq_candidates_pricing_shape_check;
ALTER TABLE public.project_rfq_candidates ADD CONSTRAINT project_rfq_candidates_pricing_shape_check CHECK (
  pricing_mode IS NULL OR
  (pricing_mode='itemized' AND jsonb_typeof(quote_entries)='array' AND jsonb_array_length(quote_entries)>0 AND quote_total_cents IS NOT NULL) OR
  (pricing_mode='total' AND coalesce(quote_entries,'null'::jsonb)='[]'::jsonb AND quote_total_cents IS NOT NULL AND quote_total_cents BETWEEN 0 AND 9007199254740991)
);

CREATE OR REPLACE FUNCTION public.normalize_project_quote_entries(p_order_id UUID,p_entries JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e JSONB;typ TEXT;target UUID;qty NUMERIC;canonical_qty NUMERIC;label TEXT;unit TEXT;price BIGINT;total NUMERIC:=0;normalized JSONB:='[]'::jsonb;seen TEXT[]:=ARRAY[]::TEXT[];
BEGIN
  IF p_entries IS NULL OR jsonb_typeof(p_entries)<>'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'INVALID_ENTRIES';END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    typ:=e->>'targetType';BEGIN target:=(e->>'targetId')::UUID;qty:=(e->>'quantity')::NUMERIC;price:=(e->>'unitPriceCents')::BIGINT;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INVALID_ENTRY';END;
    IF typ NOT IN('line','process') OR qty IS NULL OR qty<=0 OR price IS NULL OR price<0 OR typ||':'||target::TEXT=ANY(seen) THEN RAISE EXCEPTION 'INVALID_ENTRY';END IF;
    seen:=array_append(seen,typ||':'||target::TEXT);canonical_qty:=NULL;
    IF typ='line' THEN SELECT public.project_origin_required_quantity(l.volume_m3,l.pieces),l.product_name,l.unit INTO canonical_qty,label,unit FROM public.order_line_items l WHERE l.id=target AND l.order_id=p_order_id AND l.side='sell';
    ELSE SELECT CASE WHEN pr.value~'^\s*[0-9]+([.][0-9]+)?\s*$' THEN trim(pr.value)::NUMERIC END,l.product_name||' · '||pr.name,coalesce(pr.unit,'unit') INTO canonical_qty,label,unit FROM public.order_line_items l JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=public.resolve_project_process_root(l.id) WHERE pr.id=target AND l.order_id=p_order_id AND l.side='sell';END IF;
    IF canonical_qty IS NULL OR qty<>canonical_qty THEN RAISE EXCEPTION 'STALE_REQUIREMENT';END IF;
    total:=total+round(qty*price);IF total>9007199254740991 THEN RAISE EXCEPTION 'TOTAL_TOO_LARGE';END IF;
    normalized:=normalized||jsonb_build_array(jsonb_build_object('targetType',typ,'targetId',target,'label',label,'quantity',canonical_qty,'unit',unit,'unitPriceCents',price));
  END LOOP;
  RETURN jsonb_build_object('entries',normalized,'totalCents',total::BIGINT);
END $$;
REVOKE ALL ON FUNCTION public.normalize_project_quote_entries(UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_project_quote_entries(UUID,JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_project_rfq_quote_entries(p_candidate_id UUID,p_pricing_mode TEXT,p_entries JSONB,p_total_cents BIGINT,p_notes TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_rfq_candidates%ROWTYPE;r public.project_rfqs%ROWTYPE;normalized JSONB;total BIGINT;is_admin BOOLEAN:=public.is_current_user_platform_admin();
BEGIN
  IF p_pricing_mode NOT IN('itemized','total') OR length(coalesce(p_notes,''))>4000 THEN RAISE EXCEPTION 'INVALID_QUOTE';END IF;
  SELECT * INTO c FROM public.project_rfq_candidates WHERE id=p_candidate_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'CANDIDATE_NOT_FOUND';END IF;
  SELECT * INTO r FROM public.project_rfqs WHERE id=c.rfq_id FOR UPDATE;IF r.status<>'open' OR r.deadline<=now() THEN RAISE EXCEPTION 'RFQ_CLOSED';END IF;
  IF NOT(is_admin OR public.current_user_in_org(c.organization_id)) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  IF p_pricing_mode='total' THEN IF p_entries IS NULL OR p_entries<>'[]'::jsonb OR p_total_cents IS NULL OR p_total_cents<0 OR p_total_cents>9007199254740991 THEN RAISE EXCEPTION 'MIXED_OR_INVALID_TOTAL';END IF;normalized:='[]'::jsonb;total:=p_total_cents;
  ELSE IF p_total_cents IS NOT NULL THEN RAISE EXCEPTION 'MIXED_OR_INVALID_ITEMIZED';END IF;SELECT x->'entries',(x->>'totalCents')::BIGINT INTO normalized,total FROM (SELECT public.normalize_project_quote_entries(r.order_id,p_entries)x)s;END IF;
  UPDATE public.project_rfq_candidates SET pricing_mode=p_pricing_mode,quote_entries=normalized,quote_total_cents=total,quote_notes=nullif(trim(p_notes),''),status='submitted',submitted_at=now(),quote_entered_by=public.current_portal_user_id(),quote_entered_as_admin=is_admin WHERE id=c.id;
  RETURN total;
END $$;

CREATE OR REPLACE FUNCTION public.correct_project_rfq_quote_entries(p_candidate_id UUID,p_pricing_mode TEXT,p_entries JSONB,p_total_cents BIGINT,p_notes TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_rfq_candidates%ROWTYPE;r public.project_rfqs%ROWTYPE;normalized JSONB;total BIGINT;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  IF p_pricing_mode NOT IN('itemized','total') OR length(coalesce(p_notes,''))>4000 THEN RAISE EXCEPTION 'INVALID_QUOTE';END IF;
  SELECT * INTO c FROM public.project_rfq_candidates WHERE id=p_candidate_id;IF NOT FOUND THEN RAISE EXCEPTION 'CANDIDATE_NOT_FOUND';END IF;SELECT * INTO r FROM public.project_rfqs WHERE id=c.rfq_id;IF NOT FOUND THEN RAISE EXCEPTION 'RFQ_NOT_FOUND';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended((SELECT spine_id::TEXT FROM public.orders WHERE id=r.order_id),0));PERFORM 1 FROM public.orders WHERE id=r.order_id FOR UPDATE;SELECT * INTO r FROM public.project_rfqs WHERE id=c.rfq_id FOR UPDATE;SELECT * INTO c FROM public.project_rfq_candidates WHERE id=p_candidate_id FOR UPDATE;
  IF p_pricing_mode='total' THEN IF p_entries IS NULL OR p_entries<>'[]'::jsonb OR p_total_cents IS NULL OR p_total_cents<0 OR p_total_cents>9007199254740991 THEN RAISE EXCEPTION 'MIXED_OR_INVALID_TOTAL';END IF;normalized:='[]'::jsonb;total:=p_total_cents;
  ELSE IF p_total_cents IS NOT NULL THEN RAISE EXCEPTION 'MIXED_OR_INVALID_ITEMIZED';END IF;SELECT x->'entries',(x->>'totalCents')::BIGINT INTO normalized,total FROM (SELECT public.normalize_project_quote_entries(r.order_id,p_entries)x)s;END IF;
  UPDATE public.project_rfq_candidates SET pricing_mode=p_pricing_mode,quote_entries=normalized,quote_total_cents=total,quote_notes=nullif(trim(p_notes),''),status=CASE WHEN status='invited' THEN 'submitted' ELSE status END,submitted_at=coalesce(submitted_at,now()),quote_entered_by=public.current_portal_user_id(),quote_entered_as_admin=true WHERE id=c.id;
  IF c.status='awarded' THEN UPDATE public.orders SET commercial_rollup_state=CASE WHEN commercial_confirmed_at IS NULL AND resale_value_cents IS NULL THEN 'draft' ELSE 'stale' END,commercial_stale_at=CASE WHEN commercial_confirmed_at IS NULL AND resale_value_cents IS NULL THEN NULL ELSE now() END,updated_at=now() WHERE id=r.order_id;WITH RECURSIVE affected(id) AS(SELECT target_order_id FROM public.project_leg_commercial_sources WHERE source_order_id=r.order_id UNION SELECT s.target_order_id FROM public.project_leg_commercial_sources s JOIN affected a ON s.source_order_id=a.id)UPDATE public.orders SET commercial_rollup_state='stale',commercial_stale_at=now(),updated_at=now() WHERE id IN(SELECT id FROM affected);END IF;
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.submit_project_rfq_quote_entries(UUID,TEXT,JSONB,BIGINT,TEXT),public.correct_project_rfq_quote_entries(UUID,TEXT,JSONB,BIGINT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_project_rfq_quote_entries(UUID,TEXT,JSONB,BIGINT,TEXT),public.correct_project_rfq_quote_entries(UUID,TEXT,JSONB,BIGINT,TEXT) TO authenticated;

-- Canonical private allocation for downstream roll-up. Largest remainders are
-- assigned by stable origin UUID order and always sum to the quoted total.
CREATE OR REPLACE FUNCTION public.project_quote_origin_allocations(p_order_id UUID,p_candidate_id UUID)
RETURNS TABLE(origin_line_item_id UUID,available_quantity NUMERIC,source_amount_cents BIGINT,whole_package BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.project_rfq_candidates c JOIN public.project_rfqs r ON r.id=c.rfq_id WHERE c.id=p_candidate_id AND r.order_id=p_order_id) THEN RAISE EXCEPTION 'CANDIDATE_OUTSIDE_ORDER';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.order_line_items l WHERE l.order_id=p_order_id AND l.side='sell') OR EXISTS(SELECT 1 FROM public.order_line_items l WHERE l.order_id=p_order_id AND l.side='sell' AND coalesce(l.work_package_quantity,public.project_origin_required_quantity(l.volume_m3,l.pieces))<=0) THEN RAISE EXCEPTION 'INVALID_ALLOCATION_QUANTITY';END IF;
 RETURN QUERY WITH candidate AS(SELECT c.* FROM public.project_rfq_candidates c JOIN public.project_rfqs r ON r.id=c.rfq_id WHERE c.id=p_candidate_id AND r.order_id=p_order_id),quantities AS(
 SELECT coalesce(l.origin_line_item_id,l.id) origin_id,sum(coalesce(l.work_package_quantity,public.project_origin_required_quantity(l.volume_m3,l.pieces))) qty FROM public.order_line_items l WHERE l.order_id=p_order_id AND l.side='sell' GROUP BY 1
),itemized AS(SELECT q.origin_id,q.qty,sum(round((e->>'quantity')::NUMERIC*(e->>'unitPriceCents')::BIGINT))::BIGINT amount FROM candidate c CROSS JOIN LATERAL jsonb_array_elements(c.quote_entries)e JOIN public.order_line_items l ON l.order_id=p_order_id AND l.side='sell' AND ((e->>'targetType'='line' AND l.id=(e->>'targetId')::UUID)OR(e->>'targetType'='process' AND public.resolve_project_process_root(l.id)=(SELECT pr.order_line_item_id FROM public.order_line_item_process_requirements pr WHERE pr.id=(e->>'targetId')::UUID)))JOIN quantities q ON q.origin_id=coalesce(l.origin_line_item_id,l.id) WHERE c.pricing_mode='itemized' GROUP BY q.origin_id,q.qty),weights AS(SELECT q.*,sum(qty)OVER() total_qty,c.quote_total_cents total FROM quantities q CROSS JOIN candidate c WHERE c.pricing_mode='total'),floored AS(SELECT *,floor(total*qty/total_qty)::BIGINT base,(total*qty/total_qty-floor(total*qty/total_qty)) remainder FROM weights),total_alloc AS(SELECT origin_id,qty,base+(row_number()OVER(ORDER BY remainder DESC,origin_id)<=total-sum(base)OVER())::INT amount FROM floored)
SELECT origin_id,qty,amount,false FROM itemized UNION ALL SELECT origin_id,qty,amount,true FROM total_alloc;
END;
$$;
REVOKE ALL ON FUNCTION public.project_quote_origin_allocations(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.project_quote_origin_allocations(UUID,UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_project_commercial_sources(p_target_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target public.orders%ROWTYPE;result JSONB;
BEGIN
 SELECT * INTO target FROM public.orders WHERE id=p_target_order_id;IF NOT FOUND OR target.spine_id IS NULL THEN RAISE EXCEPTION 'TARGET_NOT_FOUND';END IF;IF NOT public.project_commercial_owner(target) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(payload ORDER BY payload->>'reference'),'[]'::jsonb) INTO result FROM(
  SELECT jsonb_build_object('sourceOrderId',s.id,'reference',coalesce(s.deal_code,s.code),'currency',s.currency,'sourceVersion',s.commercial_version,'sourceCandidateId',award.candidate_id,'sourceUpdatedAt',coalesce(award.updated_at,s.updated_at),'sellerName',seller.name,'wholePackage',coalesce(award.pricing_mode='total',false),'lines',coalesce(
   (SELECT jsonb_agg(jsonb_build_object('originLineItemId',cl.origin_line_item_id,'availableQuantity',cl.offered_quantity,'sourceAmountCents',cl.offered_value_cents)ORDER BY cl.origin_line_item_id)FROM public.project_leg_commercial_lines cl WHERE cl.target_order_id=s.id),
   (SELECT jsonb_agg(jsonb_build_object('originLineItemId',a.origin_line_item_id,'availableQuantity',a.available_quantity,'sourceAmountCents',a.source_amount_cents)ORDER BY a.origin_line_item_id)FROM public.project_quote_origin_allocations(s.id,award.candidate_id)a),'[]'::jsonb))payload
  FROM public.orders s JOIN public.organisations seller ON seller.id=s.seller_organisation_id
  LEFT JOIN LATERAL(SELECT c.id candidate_id,c.updated_at,c.pricing_mode FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.id=r.awarded_candidate_id WHERE r.order_id=s.id AND r.status='awarded' AND c.status='awarded' ORDER BY r.created_at DESC LIMIT 1)award ON true
  WHERE s.spine_id=target.spine_id AND s.id<>target.id AND s.buyer_organisation_id=target.seller_organisation_id AND(s.commercial_rollup_state='confirmed' OR(s.commercial_rollup_state<>'stale' AND award.candidate_id IS NOT NULL))
 )sources;RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_project_commercial_sources(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_commercial_sources(UUID) TO authenticated;

-- Total-only commercial sources are validated after the canonical selection
-- rows are written. A failure rolls the containing roll-up transaction back.
CREATE OR REPLACE FUNCTION public.enforce_total_project_source_whole_package()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE candidate_mode TEXT;
BEGIN
 SELECT pricing_mode INTO candidate_mode FROM public.project_rfq_candidates WHERE id=NEW.source_candidate_id;
 IF candidate_mode='total' AND (
   (SELECT count(*) FROM public.project_leg_commercial_sources s WHERE s.target_order_id=NEW.target_order_id AND s.source_order_id=NEW.source_order_id)
     <> (SELECT count(*) FROM public.project_quote_origin_allocations(NEW.source_order_id,NEW.source_candidate_id))
   OR EXISTS(
     SELECT 1 FROM public.project_quote_origin_allocations(NEW.source_order_id,NEW.source_candidate_id) a
     LEFT JOIN public.project_leg_commercial_sources s ON s.target_order_id=NEW.target_order_id AND s.source_order_id=NEW.source_order_id AND s.origin_line_item_id=a.origin_line_item_id
     WHERE s.id IS NULL OR s.selected_quantity<>a.available_quantity
   )
 ) THEN RAISE EXCEPTION 'TOTAL_SOURCE_IS_WHOLE_PACKAGE';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_total_project_source_whole_package ON public.project_leg_commercial_sources;
CREATE CONSTRAINT TRIGGER enforce_total_project_source_whole_package
AFTER INSERT OR UPDATE ON public.project_leg_commercial_sources DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_total_project_source_whole_package();

-- Reject legacy or inconsistent quotation state at the award persistence
-- boundary, independently of the implementation text of award_project_rfq.
CREATE OR REPLACE FUNCTION public.enforce_project_rfq_award_quote_shape()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE candidate public.project_rfq_candidates%ROWTYPE;
BEGIN
 IF NEW.status='awarded' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.awarded_candidate_id IS DISTINCT FROM NEW.awarded_candidate_id) THEN
  SELECT * INTO candidate FROM public.project_rfq_candidates WHERE id=NEW.awarded_candidate_id AND rfq_id=NEW.id;
  IF NOT FOUND OR candidate.pricing_mode IS NULL OR candidate.quote_total_cents IS NULL
    OR (candidate.pricing_mode='total' AND coalesce(candidate.quote_entries,'null'::jsonb)<>'[]'::jsonb)
    OR (candidate.pricing_mode='itemized' AND (jsonb_typeof(candidate.quote_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(candidate.quote_entries)=0))
  THEN RAISE EXCEPTION 'INCONSISTENT_QUOTATION';END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_project_rfq_award_quote_shape ON public.project_rfqs;
CREATE TRIGGER enforce_project_rfq_award_quote_shape BEFORE UPDATE ON public.project_rfqs
FOR EACH ROW EXECUTE FUNCTION public.enforce_project_rfq_award_quote_shape();

NOTIFY pgrst,'reload schema';
