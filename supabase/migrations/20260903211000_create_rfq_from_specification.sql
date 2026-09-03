-- Create the sellerless sourcing workspace and its first RFQ in one transaction.
CREATE OR REPLACE FUNCTION public.create_project_rfq_from_specification(
  p_source_order_id UUID,
  p_line_item_ids UUID[],
  p_candidate_ids UUID[],
  p_deadline TIMESTAMPTZ
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_source public.orders%ROWTYPE;
  v_spine UUID;
  v_leg_id UUID := gen_random_uuid();
  v_rfq_id UUID;
  v_code TEXT := 'LEG-'||upper(substr(replace(v_leg_id::text,'-',''),1,10));
  v_candidate UUID;
  v_line RECORD;
  v_new_line_id UUID;
  v_required NUMERIC;
  v_allocated NUMERIC;
BEGIN
  SELECT spine_id INTO v_spine FROM public.orders WHERE id=p_source_order_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_NOT_FOUND'; END IF;
  IF v_spine IS NULL THEN RAISE EXCEPTION 'SOURCE_NOT_ELIGIBLE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_spine::text,0));
  SELECT * INTO v_source FROM public.orders WHERE id=p_source_order_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_NOT_FOUND'; END IF;
  IF v_source.spine_id IS DISTINCT FROM v_spine OR v_source.lifecycle_stage<>'draft' OR v_source.upstream_deal_id IS NOT NULL OR v_source.seller_organisation_id IS NULL
    OR v_source.buyer_organisation_id IS NULL THEN RAISE EXCEPTION 'SOURCE_NOT_ELIGIBLE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id=v_source.buyer_organisation_id AND is_active AND (is_customer OR is_trader))
    OR NOT EXISTS (SELECT 1 FROM public.organisations WHERE id=v_source.seller_organisation_id AND is_active AND is_trader)
    THEN RAISE EXCEPTION 'SOURCE_NOT_ELIGIBLE'; END IF;
  IF NOT public.is_current_user_platform_admin() AND NOT public.current_user_can_create_deal_in_org(v_source.seller_organisation_id)
    THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_deadline IS NULL OR p_deadline<=now() THEN RAISE EXCEPTION 'RFQ_DEADLINE_INVALID'; END IF;
  IF coalesce(array_length(p_line_item_ids,1),0) NOT BETWEEN 1 AND 500
    OR array_length(p_line_item_ids,1)<>(SELECT count(DISTINCT x) FROM unnest(p_line_item_ids)x)
    THEN RAISE EXCEPTION 'RFQ_LINES_INVALID'; END IF;
  IF coalesce(array_length(p_candidate_ids,1),0) NOT BETWEEN 2 AND 20
    OR array_length(p_candidate_ids,1)<>(SELECT count(DISTINCT x) FROM unnest(p_candidate_ids)x)
    THEN RAISE EXCEPTION 'RFQ_CANDIDATES_INVALID'; END IF;
  IF v_source.seller_organisation_id=ANY(p_candidate_ids) THEN RAISE EXCEPTION 'SELF_DEAL'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_candidate_ids)x LEFT JOIN public.organisations o ON o.id=x
    WHERE o.id IS NULL OR NOT o.is_active OR NOT (o.is_supplier OR o.is_producer OR o.is_trader OR o.is_manufacturer))
    THEN RAISE EXCEPTION 'SELLER_INELIGIBLE'; END IF;

  IF EXISTS (SELECT 1 FROM public.orders WHERE upstream_deal_id=p_source_order_id AND deleted_at IS NULL AND lifecycle_stage<>'cancelled')
    THEN RAISE EXCEPTION 'SOURCING_LEG_EXISTS'; END IF;

  -- Lock the chosen source rows before rechecking remaining allocation.
  PERFORM 1 FROM public.order_line_items l WHERE l.id=ANY(p_line_item_ids) ORDER BY l.id FOR UPDATE;
  IF (SELECT count(*) FROM public.order_line_items l WHERE l.id=ANY(p_line_item_ids) AND l.order_id=p_source_order_id AND l.side='sell')
    <> array_length(p_line_item_ids,1) THEN RAISE EXCEPTION 'RFQ_LINES_INVALID'; END IF;
  IF (SELECT count(*) FROM public.order_line_items l WHERE l.id=ANY(p_line_item_ids))
    <> (SELECT count(DISTINCT coalesce(l.origin_line_item_id,l.id)) FROM public.order_line_items l WHERE l.id=ANY(p_line_item_ids))
    THEN RAISE EXCEPTION 'RFQ_ALLOCATION_ORIGINS_DUPLICATE'; END IF;

  FOR v_line IN SELECT l.*,coalesce(l.origin_line_item_id,l.id) AS allocation_origin_id
    FROM public.order_line_items l WHERE l.id=ANY(p_line_item_ids) ORDER BY l.line_no,l.id
  LOOP
    v_required := public.project_origin_required_quantity(v_line.volume_m3,v_line.pieces);
    SELECT coalesce(sum(w.work_package_quantity),0) INTO v_allocated
      FROM public.order_line_items w JOIN public.orders o ON o.id=w.order_id
      WHERE w.origin_line_item_id=v_line.allocation_origin_id AND o.deleted_at IS NULL AND o.lifecycle_stage<>'cancelled';
    IF v_required-v_allocated<=0 THEN RAISE EXCEPTION 'WORK_PACKAGE_OVER_ALLOCATED'; END IF;
  END LOOP;

  INSERT INTO public.orders(id,code,name,customer_organisation_id,seller_organisation_id,buyer_organisation_id,
    deal_kind,product_group,currency,value_cents,status,lifecycle_stage,deal_code,spine_id,upstream_deal_id,notes,created_by,is_manual_spine_leg)
  VALUES(v_leg_id,v_code,coalesce(v_source.name,'Project')||' - sourcing',v_source.seller_organisation_id,NULL,v_source.seller_organisation_id,
    'purchase_only',v_source.product_group,v_source.currency,NULL,'draft','draft',NULL,v_source.spine_id,p_source_order_id,NULL,public.current_portal_user_id(),false);

  FOR v_line IN SELECT l.*,coalesce(l.origin_line_item_id,l.id) AS allocation_origin_id
    FROM public.order_line_items l WHERE l.id=ANY(p_line_item_ids) ORDER BY l.line_no,l.id
  LOOP
    v_required := public.project_origin_required_quantity(v_line.volume_m3,v_line.pieces);
    SELECT coalesce(sum(w.work_package_quantity),0) INTO v_allocated
      FROM public.order_line_items w JOIN public.orders o ON o.id=w.order_id
      WHERE w.origin_line_item_id=v_line.allocation_origin_id AND o.deleted_at IS NULL AND o.lifecycle_stage<>'cancelled';
    IF v_required-v_allocated<=0 THEN RAISE EXCEPTION 'WORK_PACKAGE_OVER_ALLOCATED'; END IF;
    INSERT INTO public.order_line_items(order_id,side,line_no,product_name,wood_species,humidity,processing,quality,product_type,grade_note,
      product_name_option_id,wood_species_option_id,humidity_option_id,processing_option_id,quality_option_id,product_type_option_id,
      thickness,width,length,pieces,volume_m3,unit,unit_price_cents,line_total_cents,notes,catalog_product_id,catalog_variant_id,is_standard,
      origin_line_item_id,work_package_quantity,specification_fields)
    VALUES(v_leg_id,'sell',v_line.line_no,v_line.product_name,v_line.wood_species,v_line.humidity,v_line.processing,v_line.quality,v_line.product_type,v_line.grade_note,
      v_line.product_name_option_id,v_line.wood_species_option_id,v_line.humidity_option_id,v_line.processing_option_id,v_line.quality_option_id,v_line.product_type_option_id,
      v_line.thickness,v_line.width,v_line.length,CASE WHEN v_line.volume_m3 IS NULL THEN (v_required-v_allocated)::text ELSE v_line.pieces END,
      CASE WHEN v_line.volume_m3 IS NULL THEN NULL ELSE v_required-v_allocated END,v_line.unit,NULL,NULL,v_line.notes,v_line.catalog_product_id,v_line.catalog_variant_id,v_line.is_standard,
      v_line.allocation_origin_id,v_required-v_allocated,v_line.specification_fields) RETURNING id INTO v_new_line_id;
    INSERT INTO public.order_line_item_process_requirements(order_line_item_id,field_key,name,value,unit,sort_order,field_type,is_required,is_active)
      SELECT v_new_line_id,field_key,name,value,unit,sort_order,field_type,is_required,is_active
      FROM public.order_line_item_process_requirements WHERE order_line_item_id=v_line.id;
  END LOOP;

  INSERT INTO public.project_rfqs(organization_id,order_id,deadline,created_by)
    VALUES(v_source.seller_organisation_id,v_leg_id,p_deadline,public.current_portal_user_id()) RETURNING id INTO v_rfq_id;
  FOREACH v_candidate IN ARRAY p_candidate_ids LOOP
    INSERT INTO public.project_rfq_candidates(organization_id,rfq_id) VALUES(v_candidate,v_rfq_id);
  END LOOP;
  RETURN jsonb_build_object('projectId',v_leg_id,'rfqId',v_rfq_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_rfq_from_specification(UUID,UUID[],UUID[],TIMESTAMPTZ) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_project_rfq_from_specification(UUID,UUID[],UUID[],TIMESTAMPTZ) TO authenticated;
