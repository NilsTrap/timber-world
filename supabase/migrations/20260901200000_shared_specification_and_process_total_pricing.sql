-- Keep the technical specification shared by every active leg in a spine, while
-- allowing quotations to price each process either by unit or by total amount.

CREATE OR REPLACE FUNCTION public.copy_origin_specification_line_to_spine(p_origin_line_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE root public.order_line_items%ROWTYPE; root_order public.orders%ROWTYPE; inserted_count INTEGER;
BEGIN
  SELECT * INTO root FROM public.order_line_items WHERE id=p_origin_line_id AND side='sell' AND origin_line_item_id IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO root_order FROM public.orders WHERE id=root.order_id;
  IF NOT FOUND OR root_order.spine_id IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.order_line_items(
    order_id,side,line_no,product_name,wood_species,humidity,processing,quality,product_type,grade_note,
    product_name_option_id,wood_species_option_id,humidity_option_id,processing_option_id,quality_option_id,
    product_type_option_id,thickness,width,length,pieces,volume_m3,unit,unit_price_cents,line_total_cents,
    notes,catalog_product_id,catalog_variant_id,is_standard,origin_line_item_id,work_package_quantity,specification_fields
  )
  SELECT leg.id,'sell',root.line_no,root.product_name,root.wood_species,root.humidity,root.processing,root.quality,root.product_type,root.grade_note,
    root.product_name_option_id,root.wood_species_option_id,root.humidity_option_id,root.processing_option_id,root.quality_option_id,
    root.product_type_option_id,root.thickness,root.width,root.length,root.pieces,root.volume_m3,root.unit,NULL,NULL,
    root.notes,root.catalog_product_id,root.catalog_variant_id,root.is_standard,root.id,
    CASE WHEN leg.seller_organisation_id IS NULL
      THEN public.project_origin_required_quantity(root.volume_m3,root.pieces)
      ELSE NULL
    END,root.specification_fields
  FROM public.orders leg
  WHERE leg.spine_id=root_order.spine_id AND leg.id<>root.order_id AND leg.lifecycle_stage<>'cancelled' AND leg.deleted_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.order_line_items existing WHERE existing.order_id=leg.id AND existing.origin_line_item_id=root.id);
  GET DIAGNOSTICS inserted_count=ROW_COUNT;
  RETURN inserted_count;
END $$;
REVOKE ALL ON FUNCTION public.copy_origin_specification_line_to_spine(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.copy_origin_specification_line_to_spine(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.share_origin_specification_line() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.side='sell' AND NEW.origin_line_item_id IS NULL THEN
    PERFORM public.copy_origin_specification_line_to_spine(NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS share_origin_specification_line ON public.order_line_items;
CREATE TRIGGER share_origin_specification_line AFTER INSERT ON public.order_line_items
FOR EACH ROW EXECUTE FUNCTION public.share_origin_specification_line();

-- Repair existing spines that received specification lines after their legs had
-- already been created.
DO $$ DECLARE line RECORD; BEGIN
  FOR line IN SELECT l.id FROM public.order_line_items l JOIN public.orders o ON o.id=l.order_id
    WHERE l.side='sell' AND l.origin_line_item_id IS NULL AND o.spine_id IS NOT NULL AND o.deleted_at IS NULL
  LOOP PERFORM public.copy_origin_specification_line_to_spine(line.id); END LOOP;
END $$;

ALTER TABLE public.project_rfq_candidates DROP CONSTRAINT IF EXISTS project_rfq_candidates_pricing_mode_check;
ALTER TABLE public.project_rfq_candidates ADD CONSTRAINT project_rfq_candidates_pricing_mode_check
  CHECK (pricing_mode IS NULL OR pricing_mode IN ('itemized','itemized_total','total'));
ALTER TABLE public.project_rfq_candidates DROP CONSTRAINT IF EXISTS project_rfq_candidates_pricing_shape_check;
ALTER TABLE public.project_rfq_candidates ADD CONSTRAINT project_rfq_candidates_pricing_shape_check CHECK (
  pricing_mode IS NULL OR
  (pricing_mode IN ('itemized','itemized_total') AND jsonb_typeof(quote_entries)='array' AND jsonb_array_length(quote_entries)>0 AND quote_total_cents IS NOT NULL) OR
  (pricing_mode='total' AND coalesce(quote_entries,'null'::jsonb)='[]'::jsonb AND quote_total_cents IS NOT NULL AND quote_total_cents BETWEEN 0 AND 9007199254740991)
);

CREATE OR REPLACE FUNCTION public.normalize_project_quote_entry_totals(p_order_id UUID,p_entries JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE normalized JSONB; total NUMERIC;
BEGIN
  SELECT result->'entries' INTO normalized FROM (SELECT public.normalize_project_quote_entries(p_order_id,p_entries) result)s;
  SELECT coalesce(sum((entry->>'unitPriceCents')::BIGINT),0) INTO total FROM jsonb_array_elements(normalized) entry;
  IF total>9007199254740991 THEN RAISE EXCEPTION 'TOTAL_TOO_LARGE';END IF;
  RETURN jsonb_build_object('entries',normalized,'totalCents',total::BIGINT);
END $$;
REVOKE ALL ON FUNCTION public.normalize_project_quote_entry_totals(UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_project_quote_entry_totals(UUID,JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_project_rfq_quote_entries(p_candidate_id UUID,p_pricing_mode TEXT,p_entries JSONB,p_total_cents BIGINT,p_notes TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_rfq_candidates%ROWTYPE;r public.project_rfqs%ROWTYPE;normalized JSONB;total BIGINT;is_admin BOOLEAN:=public.is_current_user_platform_admin();
BEGIN
  IF p_pricing_mode NOT IN('itemized','itemized_total','total') OR length(coalesce(p_notes,''))>4000 THEN RAISE EXCEPTION 'INVALID_QUOTE';END IF;
  SELECT * INTO c FROM public.project_rfq_candidates WHERE id=p_candidate_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'CANDIDATE_NOT_FOUND';END IF;
  SELECT * INTO r FROM public.project_rfqs WHERE id=c.rfq_id FOR UPDATE;IF r.status<>'open' OR r.deadline<=now() THEN RAISE EXCEPTION 'RFQ_CLOSED';END IF;
  IF NOT(is_admin OR public.current_user_in_org(c.organization_id)) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  IF p_pricing_mode='total' THEN
    IF p_entries IS NULL OR p_entries<>'[]'::jsonb OR p_total_cents IS NULL OR p_total_cents<0 OR p_total_cents>9007199254740991 THEN RAISE EXCEPTION 'MIXED_OR_INVALID_TOTAL';END IF;normalized:='[]'::jsonb;total:=p_total_cents;
  ELSE
    IF p_total_cents IS NOT NULL THEN RAISE EXCEPTION 'MIXED_OR_INVALID_ITEMIZED';END IF;
    IF p_pricing_mode='itemized_total' THEN SELECT x->'entries',(x->>'totalCents')::BIGINT INTO normalized,total FROM (SELECT public.normalize_project_quote_entry_totals(r.order_id,p_entries)x)s;
    ELSE SELECT x->'entries',(x->>'totalCents')::BIGINT INTO normalized,total FROM (SELECT public.normalize_project_quote_entries(r.order_id,p_entries)x)s;END IF;
  END IF;
  UPDATE public.project_rfq_candidates SET pricing_mode=p_pricing_mode,quote_entries=normalized,quote_total_cents=total,quote_notes=nullif(trim(p_notes),''),status='submitted',submitted_at=now(),quote_entered_by=public.current_portal_user_id(),quote_entered_as_admin=is_admin WHERE id=c.id;
  RETURN total;
END $$;

CREATE OR REPLACE FUNCTION public.correct_project_rfq_quote_entries(p_candidate_id UUID,p_pricing_mode TEXT,p_entries JSONB,p_total_cents BIGINT,p_notes TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_rfq_candidates%ROWTYPE;r public.project_rfqs%ROWTYPE;normalized JSONB;total BIGINT;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  IF p_pricing_mode NOT IN('itemized','itemized_total','total') OR length(coalesce(p_notes,''))>4000 THEN RAISE EXCEPTION 'INVALID_QUOTE';END IF;
  SELECT * INTO c FROM public.project_rfq_candidates WHERE id=p_candidate_id;IF NOT FOUND THEN RAISE EXCEPTION 'CANDIDATE_NOT_FOUND';END IF;SELECT * INTO r FROM public.project_rfqs WHERE id=c.rfq_id;IF NOT FOUND THEN RAISE EXCEPTION 'RFQ_NOT_FOUND';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended((SELECT spine_id::TEXT FROM public.orders WHERE id=r.order_id),0));PERFORM 1 FROM public.orders WHERE id=r.order_id FOR UPDATE;SELECT * INTO r FROM public.project_rfqs WHERE id=c.rfq_id FOR UPDATE;SELECT * INTO c FROM public.project_rfq_candidates WHERE id=p_candidate_id FOR UPDATE;
  IF p_pricing_mode='total' THEN
    IF p_entries IS NULL OR p_entries<>'[]'::jsonb OR p_total_cents IS NULL OR p_total_cents<0 OR p_total_cents>9007199254740991 THEN RAISE EXCEPTION 'MIXED_OR_INVALID_TOTAL';END IF;normalized:='[]'::jsonb;total:=p_total_cents;
  ELSE
    IF p_total_cents IS NOT NULL THEN RAISE EXCEPTION 'MIXED_OR_INVALID_ITEMIZED';END IF;
    IF p_pricing_mode='itemized_total' THEN SELECT x->'entries',(x->>'totalCents')::BIGINT INTO normalized,total FROM (SELECT public.normalize_project_quote_entry_totals(r.order_id,p_entries)x)s;
    ELSE SELECT x->'entries',(x->>'totalCents')::BIGINT INTO normalized,total FROM (SELECT public.normalize_project_quote_entries(r.order_id,p_entries)x)s;END IF;
  END IF;
  UPDATE public.project_rfq_candidates SET pricing_mode=p_pricing_mode,quote_entries=normalized,quote_total_cents=total,quote_notes=nullif(trim(p_notes),''),status=CASE WHEN status='invited' THEN 'submitted' ELSE status END,submitted_at=coalesce(submitted_at,now()),quote_entered_by=public.current_portal_user_id(),quote_entered_as_admin=true WHERE id=c.id;
  IF c.status='awarded' THEN UPDATE public.orders SET commercial_rollup_state=CASE WHEN commercial_confirmed_at IS NULL AND resale_value_cents IS NULL THEN 'draft' ELSE 'stale' END,commercial_stale_at=CASE WHEN commercial_confirmed_at IS NULL AND resale_value_cents IS NULL THEN NULL ELSE now() END,updated_at=now() WHERE id=r.order_id;WITH RECURSIVE affected(id) AS(SELECT target_order_id FROM public.project_leg_commercial_sources WHERE source_order_id=r.order_id UNION SELECT s.target_order_id FROM public.project_leg_commercial_sources s JOIN affected a ON s.source_order_id=a.id)UPDATE public.orders SET commercial_rollup_state='stale',commercial_stale_at=now(),updated_at=now() WHERE id IN(SELECT id FROM affected);END IF;
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.submit_project_rfq_quote_entries(UUID,TEXT,JSONB,BIGINT,TEXT),public.correct_project_rfq_quote_entries(UUID,TEXT,JSONB,BIGINT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_project_rfq_quote_entries(UUID,TEXT,JSONB,BIGINT,TEXT),public.correct_project_rfq_quote_entries(UUID,TEXT,JSONB,BIGINT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_quote_origin_allocations(p_order_id UUID,p_candidate_id UUID)
RETURNS TABLE(origin_line_item_id UUID,available_quantity NUMERIC,source_amount_cents BIGINT,whole_package BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.project_rfq_candidates c JOIN public.project_rfqs r ON r.id=c.rfq_id WHERE c.id=p_candidate_id AND r.order_id=p_order_id) THEN RAISE EXCEPTION 'CANDIDATE_OUTSIDE_ORDER';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.order_line_items l WHERE l.order_id=p_order_id AND l.side='sell') OR EXISTS(SELECT 1 FROM public.order_line_items l WHERE l.order_id=p_order_id AND l.side='sell' AND coalesce(l.work_package_quantity,public.project_origin_required_quantity(l.volume_m3,l.pieces))<=0) THEN RAISE EXCEPTION 'INVALID_ALLOCATION_QUANTITY';END IF;
 RETURN QUERY WITH candidate AS(SELECT c.* FROM public.project_rfq_candidates c JOIN public.project_rfqs r ON r.id=c.rfq_id WHERE c.id=p_candidate_id AND r.order_id=p_order_id),quantities AS(
 SELECT coalesce(l.origin_line_item_id,l.id) origin_id,sum(coalesce(l.work_package_quantity,public.project_origin_required_quantity(l.volume_m3,l.pieces))) qty FROM public.order_line_items l WHERE l.order_id=p_order_id AND l.side='sell' GROUP BY 1
),itemized AS(SELECT q.origin_id,q.qty,sum(CASE WHEN c.pricing_mode='itemized_total' THEN (e->>'unitPriceCents')::BIGINT ELSE round((e->>'quantity')::NUMERIC*(e->>'unitPriceCents')::BIGINT) END)::BIGINT amount FROM candidate c CROSS JOIN LATERAL jsonb_array_elements(c.quote_entries)e JOIN public.order_line_items l ON l.order_id=p_order_id AND l.side='sell' AND ((e->>'targetType'='line' AND l.id=(e->>'targetId')::UUID)OR(e->>'targetType'='process' AND public.resolve_project_process_root(l.id)=(SELECT pr.order_line_item_id FROM public.order_line_item_process_requirements pr WHERE pr.id=(e->>'targetId')::UUID)))JOIN quantities q ON q.origin_id=coalesce(l.origin_line_item_id,l.id) WHERE c.pricing_mode IN('itemized','itemized_total') GROUP BY q.origin_id,q.qty),weights AS(SELECT q.*,sum(qty)OVER() total_qty,c.quote_total_cents total FROM quantities q CROSS JOIN candidate c WHERE c.pricing_mode='total'),floored AS(SELECT *,floor(total*qty/total_qty)::BIGINT base,(total*qty/total_qty-floor(total*qty/total_qty)) remainder FROM weights),total_alloc AS(SELECT origin_id,qty,base+(row_number()OVER(ORDER BY remainder DESC,origin_id)<=total-sum(base)OVER())::INT amount FROM floored)
 SELECT origin_id,qty,amount,false FROM itemized UNION ALL SELECT origin_id,qty,amount,true FROM total_alloc;
END $$;
REVOKE ALL ON FUNCTION public.project_quote_origin_allocations(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.project_quote_origin_allocations(UUID,UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_project_rfq_award_quote_shape()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE candidate public.project_rfq_candidates%ROWTYPE;
BEGIN
 IF NEW.status='awarded' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.awarded_candidate_id IS DISTINCT FROM NEW.awarded_candidate_id) THEN
  SELECT * INTO candidate FROM public.project_rfq_candidates WHERE id=NEW.awarded_candidate_id AND rfq_id=NEW.id;
  IF NOT FOUND OR candidate.pricing_mode IS NULL OR candidate.quote_total_cents IS NULL
    OR (candidate.pricing_mode='total' AND coalesce(candidate.quote_entries,'null'::jsonb)<>'[]'::jsonb)
    OR (candidate.pricing_mode IN('itemized','itemized_total') AND (jsonb_typeof(candidate.quote_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(candidate.quote_entries)=0))
  THEN RAISE EXCEPTION 'INCONSISTENT_QUOTATION';END IF;
 END IF;
 RETURN NEW;
END $$;

NOTIFY pgrst,'reload schema';
