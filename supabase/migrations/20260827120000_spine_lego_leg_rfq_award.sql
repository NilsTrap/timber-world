-- Manual same-spine Lego legs and award-in-place supplier RFQs.
-- The spine's single active buy/sell or sale-only deal owns the canonical
-- specification. A clicked downstream deal is navigation context only.

ALTER TABLE public.orders ALTER COLUMN customer_organisation_id DROP NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_manual_spine_leg BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.order_line_items
  ADD COLUMN IF NOT EXISTS origin_line_item_id UUID,
  ADD COLUMN IF NOT EXISTS work_package_quantity NUMERIC(14,4);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.order_line_items'::regclass
      AND conname = 'order_line_items_origin_line_item_fkey'
  ) THEN
    ALTER TABLE public.order_line_items
      ADD CONSTRAINT order_line_items_origin_line_item_fkey
      FOREIGN KEY (origin_line_item_id) REFERENCES public.order_line_items(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.order_line_items'::regclass
      AND conname = 'order_line_items_work_package_quantity_check'
  ) THEN
    ALTER TABLE public.order_line_items
      ADD CONSTRAINT order_line_items_work_package_quantity_check
      CHECK (
        (origin_line_item_id IS NULL AND work_package_quantity IS NULL)
        OR (origin_line_item_id IS NOT NULL AND work_package_quantity > 0)
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_bilateral_or_draft_placeholder_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_bilateral_or_draft_placeholder_check
      CHECK (
        seller_organisation_id IS DISTINCT FROM buyer_organisation_id
        AND (
          num_nonnulls(seller_organisation_id, buyer_organisation_id) = 2
          OR (lifecycle_stage = 'draft' AND num_nonnulls(seller_organisation_id, buyer_organisation_id) = 1)
        )
      ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_line_items_origin
  ON public.order_line_items(origin_line_item_id, order_id)
  WHERE origin_line_item_id IS NOT NULL;

-- The former chain guard allowed only one outgoing leg per buyer. Manual Lego
-- assembly permits parallel legs and relies on atomic awarded allocation instead.
DROP INDEX IF EXISTS public.orders_one_active_outgoing_leg_per_spine_buyer;
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_legacy_outgoing_leg_per_spine_buyer
  ON public.orders(spine_id,buyer_organisation_id)
  WHERE spine_id IS NOT NULL AND buyer_organisation_id IS NOT NULL
    AND lifecycle_stage <> 'cancelled' AND NOT is_manual_spine_leg;

-- The older trigger inferred adjacency from matching parties. Lego topology is
-- spine-only, but retaining this advisory lock serializes same-spine mutations.
CREATE OR REPLACE FUNCTION public.lock_project_spine_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.spine_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.spine_id::text, 0));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.spine_origin_order_id(p_source_order_id UUID)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_spine UUID; v_origin UUID; v_count INTEGER;
BEGIN
  SELECT spine_id INTO v_spine FROM public.orders WHERE id = p_source_order_id;
  IF NOT FOUND OR v_spine IS NULL THEN RAISE EXCEPTION 'SPINE_NOT_FOUND'; END IF;

  SELECT count(*) INTO v_count
  FROM public.orders
  WHERE spine_id = v_spine
    AND deal_kind IN ('buy_sell','sale_only')
    AND lifecycle_stage <> 'cancelled'
    AND EXISTS (
      SELECT 1 FROM public.order_line_items l
      WHERE l.order_id=orders.id AND l.side='sell' AND l.origin_line_item_id IS NULL
    );
  IF v_count <> 1 THEN RAISE EXCEPTION 'SPINE_ORIGIN_AMBIGUOUS'; END IF;
  SELECT id INTO v_origin
  FROM public.orders
  WHERE spine_id = v_spine
    AND deal_kind IN ('buy_sell','sale_only')
    AND lifecycle_stage <> 'cancelled'
    AND EXISTS (
      SELECT 1 FROM public.order_line_items l
      WHERE l.order_id=orders.id AND l.side='sell' AND l.origin_line_item_id IS NULL
    )
  ORDER BY id LIMIT 1;
  RETURN v_origin;
END;
$$;

CREATE OR REPLACE FUNCTION public.mint_project_deal_code(p_order_id UUID)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seller TEXT; v_buyer TEXT; v_code TEXT;
BEGIN
  SELECT substr(regexp_replace(upper(coalesce(s.code,'TIM')),'[^A-Z0-9]','','g'),1,3),
         substr(regexp_replace(upper(coalesce(b.code,'XXX')),'[^A-Z0-9]','','g'),1,3)
    INTO v_seller, v_buyer
  FROM public.orders o
  JOIN public.organisations s ON s.id = o.seller_organisation_id
  JOIN public.organisations b ON b.id = o.buyer_organisation_id
  WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PARTY_MISSING'; END IF;
  v_seller := coalesce(nullif(v_seller,''),'TIM');
  v_buyer := coalesce(nullif(v_buyer,''),'XXX');
  v_code := v_seller||'-'||v_buyer||'-'||lpad(public.next_counter('deal:'||v_seller||':'||v_buyer)::text,3,'0');
  UPDATE public.orders SET deal_code = coalesce(deal_code, v_code) WHERE id = p_order_id
  RETURNING deal_code INTO v_code;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_origin_required_quantity(p_volume NUMERIC, p_pieces TEXT)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_quantity NUMERIC;
BEGIN
  IF p_volume IS NOT NULL THEN v_quantity := p_volume;
  ELSIF coalesce(p_pieces,'') ~ '^\s*[0-9]+([.][0-9]+)?\s*$' THEN v_quantity := trim(p_pieces)::numeric;
  ELSE RAISE EXCEPTION 'ORIGIN_QUANTITY_UNAVAILABLE';
  END IF;
  IF v_quantity <= 0 THEN RAISE EXCEPTION 'ORIGIN_QUANTITY_INVALID'; END IF;
  RETURN v_quantity;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_same_spine_project_leg(
  p_source_order_id UUID,
  p_buyer_id UUID,
  p_seller_id UUID,
  p_work_packages JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_source public.orders%ROWTYPE;
  v_spine UUID;
  v_origin_id UUID;
  v_leg_id UUID := gen_random_uuid();
  v_code TEXT := 'LEG-'||upper(substr(replace(v_leg_id::text,'-',''),1,10));
  v_count INTEGER;
  v_requested NUMERIC;
  v_required NUMERIC;
  v_awarded NUMERIC;
  v_item RECORD;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF num_nonnulls(p_buyer_id,p_seller_id) = 0 THEN RAISE EXCEPTION 'PARTY_MISSING'; END IF;
  IF p_buyer_id IS NOT NULL AND p_buyer_id = p_seller_id THEN RAISE EXCEPTION 'SELF_DEAL'; END IF;
  IF p_buyer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organisations WHERE id=p_buyer_id AND is_active AND (is_customer OR is_trader)
  ) THEN RAISE EXCEPTION 'BUYER_INELIGIBLE'; END IF;
  IF p_seller_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organisations WHERE id=p_seller_id AND is_active AND (is_trader OR is_supplier OR is_producer OR is_manufacturer)
  ) THEN RAISE EXCEPTION 'SELLER_INELIGIBLE'; END IF;
  IF jsonb_typeof(p_work_packages) <> 'array' OR jsonb_array_length(p_work_packages) = 0 THEN
    RAISE EXCEPTION 'WORK_PACKAGE_EMPTY';
  END IF;

  SELECT spine_id INTO v_spine FROM public.orders WHERE id=p_source_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_NOT_FOUND'; END IF;
  IF v_spine IS NULL THEN RAISE EXCEPTION 'SPINE_NOT_FOUND'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_spine::text,0));
  SELECT * INTO v_source FROM public.orders WHERE id=p_source_order_id FOR UPDATE;
  IF NOT FOUND OR v_source.spine_id IS DISTINCT FROM v_spine THEN RAISE EXCEPTION 'SOURCE_CHANGED'; END IF;
  IF v_source.lifecycle_stage <> 'draft' THEN RAISE EXCEPTION 'SOURCE_NOT_DRAFT'; END IF;
  v_origin_id := public.spine_origin_order_id(p_source_order_id);

  SELECT count(*), count(DISTINCT origin_line_item_id)
    INTO v_count, v_required
  FROM jsonb_to_recordset(p_work_packages) AS x(origin_line_item_id UUID, quantity NUMERIC);
  IF v_count <> v_required THEN RAISE EXCEPTION 'WORK_PACKAGE_DUPLICATE'; END IF;

  SELECT count(*) INTO v_count
  FROM jsonb_to_recordset(p_work_packages) AS x(origin_line_item_id UUID, quantity NUMERIC)
  JOIN public.order_line_items l ON l.id=x.origin_line_item_id
  WHERE l.order_id=v_origin_id AND l.side='sell' AND l.origin_line_item_id IS NULL;
  IF v_count <> jsonb_array_length(p_work_packages) THEN RAISE EXCEPTION 'ORIGIN_LINE_INVALID'; END IF;

  -- Lock every selected canonical origin row in UUID order before validating it.
  PERFORM 1
  FROM public.order_line_items l
  JOIN jsonb_to_recordset(p_work_packages) AS x(origin_line_item_id UUID, quantity NUMERIC)
    ON x.origin_line_item_id=l.id
  WHERE l.order_id=v_origin_id AND l.side='sell'
  ORDER BY l.id FOR UPDATE OF l;

  FOR v_item IN
    SELECT x.origin_line_item_id, x.quantity, l.*
    FROM jsonb_to_recordset(p_work_packages) AS x(origin_line_item_id UUID, quantity NUMERIC)
    JOIN public.order_line_items l ON l.id=x.origin_line_item_id
    WHERE l.order_id=v_origin_id AND l.side='sell'
    ORDER BY l.id
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN RAISE EXCEPTION 'WORK_PACKAGE_QUANTITY_INVALID'; END IF;
    v_required := public.project_origin_required_quantity(v_item.volume_m3,v_item.pieces);
    SELECT coalesce(sum(w.work_package_quantity),0) INTO v_awarded
    FROM public.order_line_items w JOIN public.orders o ON o.id=w.order_id
    WHERE w.origin_line_item_id=v_item.origin_line_item_id
      AND o.lifecycle_stage <> 'cancelled'
      AND o.seller_organisation_id IS NOT NULL AND o.buyer_organisation_id IS NOT NULL;
    IF v_item.quantity > v_required-v_awarded THEN RAISE EXCEPTION 'WORK_PACKAGE_OVER_ALLOCATED'; END IF;
  END LOOP;
  INSERT INTO public.orders(
    id,code,name,customer_organisation_id,seller_organisation_id,buyer_organisation_id,
    deal_kind,product_group,currency,value_cents,status,lifecycle_stage,deal_code,
    spine_id,upstream_deal_id,notes,created_by,is_manual_spine_leg
  ) VALUES (
    v_leg_id,v_code,coalesce(v_source.name,'Project')||' - leg',p_buyer_id,p_seller_id,p_buyer_id,
    CASE WHEN p_seller_id IS NULL THEN 'purchase_only' WHEN p_buyer_id IS NULL THEN 'sale_only' ELSE 'buy_sell' END,
    v_source.product_group,v_source.currency,NULL,'draft','draft',NULL,
    v_source.spine_id,NULL,NULL,public.current_portal_user_id(),true
  );

  INSERT INTO public.order_line_items(
    order_id,side,line_no,product_name,wood_species,humidity,processing,quality,product_type,grade_note,
    product_name_option_id,wood_species_option_id,humidity_option_id,processing_option_id,quality_option_id,
    product_type_option_id,thickness,width,length,pieces,volume_m3,unit,unit_price_cents,line_total_cents,
    notes,catalog_product_id,catalog_variant_id,is_standard,origin_line_item_id,work_package_quantity
  )
  SELECT v_leg_id,'sell',(row_number() OVER (ORDER BY l.line_no,l.id))::integer,l.product_name,l.wood_species,l.humidity,
    l.processing,l.quality,l.product_type,l.grade_note,l.product_name_option_id,l.wood_species_option_id,
    l.humidity_option_id,l.processing_option_id,l.quality_option_id,l.product_type_option_id,l.thickness,l.width,
    l.length,CASE WHEN l.volume_m3 IS NULL THEN x.quantity::text ELSE l.pieces END,
    CASE WHEN l.volume_m3 IS NULL THEN NULL ELSE x.quantity END,l.unit,NULL,NULL,l.notes,
    l.catalog_product_id,l.catalog_variant_id,l.is_standard,l.id,x.quantity
  FROM jsonb_to_recordset(p_work_packages) AS x(origin_line_item_id UUID, quantity NUMERIC)
  JOIN public.order_line_items l ON l.id=x.origin_line_item_id
  ORDER BY l.line_no,l.id;

  IF p_buyer_id IS NOT NULL AND p_seller_id IS NOT NULL THEN PERFORM public.mint_project_deal_code(v_leg_id); END IF;
  RETURN v_leg_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_project_leg_party(
  p_order_id UUID, p_side TEXT, p_organisation_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders%ROWTYPE; v_code TEXT; v_over BOOLEAN;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_side NOT IN ('buyer','seller') THEN RAISE EXCEPTION 'SIDE_INVALID'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEG_NOT_FOUND'; END IF;
  IF v_order.lifecycle_stage <> 'draft' THEN RAISE EXCEPTION 'LEG_NOT_DRAFT'; END IF;
  IF num_nonnulls(v_order.buyer_organisation_id,v_order.seller_organisation_id) <> 1 THEN RAISE EXCEPTION 'LEG_NOT_PLACEHOLDER'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_order.spine_id::text,0));
  PERFORM 1 FROM public.order_line_items origin
  WHERE origin.id IN (SELECT wp.origin_line_item_id FROM public.order_line_items wp WHERE wp.order_id=v_order.id)
  ORDER BY origin.id FOR UPDATE;
  PERFORM 1 FROM public.order_line_items wp
  WHERE wp.origin_line_item_id IN (SELECT own.origin_line_item_id FROM public.order_line_items own WHERE own.order_id=v_order.id)
  ORDER BY wp.origin_line_item_id,wp.id FOR UPDATE;
  SELECT EXISTS (
    SELECT 1 FROM public.order_line_items origin
    JOIN public.order_line_items own ON own.order_id=v_order.id AND own.origin_line_item_id=origin.id
    WHERE (
      SELECT coalesce(sum(w.work_package_quantity),0)
      FROM public.order_line_items w JOIN public.orders d ON d.id=w.order_id
      WHERE w.origin_line_item_id=origin.id AND d.lifecycle_stage<>'cancelled'
        AND d.buyer_organisation_id IS NOT NULL AND d.seller_organisation_id IS NOT NULL
    ) + own.work_package_quantity >
      public.project_origin_required_quantity(origin.volume_m3,origin.pieces)
  ) INTO v_over;
  IF v_over THEN RAISE EXCEPTION 'WORK_PACKAGE_OVER_ALLOCATED'; END IF;
  IF p_side='buyer' THEN
    IF v_order.buyer_organisation_id IS NOT NULL THEN RAISE EXCEPTION 'BUYER_ALREADY_SET'; END IF;
    IF p_organisation_id=v_order.seller_organisation_id THEN RAISE EXCEPTION 'SELF_DEAL'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id=p_organisation_id AND is_active AND (is_customer OR is_trader)) THEN RAISE EXCEPTION 'BUYER_INELIGIBLE'; END IF;
    UPDATE public.orders SET buyer_organisation_id=p_organisation_id,customer_organisation_id=p_organisation_id,
      deal_kind='buy_sell' WHERE id=p_order_id;
  ELSE
    IF v_order.seller_organisation_id IS NOT NULL THEN RAISE EXCEPTION 'SELLER_ALREADY_SET'; END IF;
    IF EXISTS (SELECT 1 FROM public.project_rfqs WHERE order_id=p_order_id AND status='open') THEN RAISE EXCEPTION 'RFQ_ALREADY_OPEN'; END IF;
    IF p_organisation_id=v_order.buyer_organisation_id THEN RAISE EXCEPTION 'SELF_DEAL'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id=p_organisation_id AND is_active AND (is_trader OR is_supplier OR is_producer OR is_manufacturer)) THEN RAISE EXCEPTION 'SELLER_INELIGIBLE'; END IF;
    UPDATE public.orders SET seller_organisation_id=p_organisation_id,deal_kind='buy_sell' WHERE id=p_order_id;
  END IF;
  v_code := public.mint_project_deal_code(p_order_id);
  RETURN jsonb_build_object('orderId',p_order_id,'dealCode',v_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_spine_origin_allocation(p_source_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_origin UUID;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  v_origin := public.spine_origin_order_id(p_source_order_id);
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'originLineItemId',l.id,'lineNo',l.line_no,'productName',l.product_name,'unit',l.unit,
      'requiredQuantity',a.required_quantity,'requestedQuantity',a.requested_quantity,
      'awardedQuantity',a.awarded_quantity,
      'remainingQuantity',greatest(a.required_quantity-a.awarded_quantity,0)
    ) ORDER BY l.line_no,l.id),'[]'::jsonb)
    FROM public.order_line_items l
    CROSS JOIN LATERAL (
      SELECT
        public.project_origin_required_quantity(l.volume_m3,l.pieces) required_quantity,
        coalesce(sum(w.work_package_quantity) FILTER (WHERE o.lifecycle_stage<>'cancelled'),0) requested_quantity,
        coalesce(sum(w.work_package_quantity) FILTER (WHERE o.lifecycle_stage<>'cancelled' AND o.buyer_organisation_id IS NOT NULL AND o.seller_organisation_id IS NOT NULL),0) awarded_quantity
      FROM public.order_line_items w JOIN public.orders o ON o.id=w.order_id
      WHERE w.origin_line_item_id=l.id
    ) a
    WHERE l.order_id=v_origin AND l.side='sell'
  );
END;
$$;

-- RFQs belong only on buyer-only Draft placeholders and are admin-managed.
CREATE OR REPLACE FUNCTION public.create_project_rfq(p_order_id UUID, p_candidate_ids UUID[], p_deadline TIMESTAMPTZ)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders%ROWTYPE; v_rfq UUID; v_candidate UUID; v_origin UUID;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEG_NOT_FOUND'; END IF;
  IF v_order.lifecycle_stage<>'draft' OR v_order.buyer_organisation_id IS NULL OR v_order.seller_organisation_id IS NOT NULL THEN RAISE EXCEPTION 'SELLER_PLACEHOLDER_REQUIRED'; END IF;
  IF v_order.spine_id IS NULL THEN RAISE EXCEPTION 'SPINE_NOT_FOUND'; END IF;
  v_origin := public.spine_origin_order_id(p_order_id);
  IF NOT EXISTS (SELECT 1 FROM public.order_line_items wp WHERE wp.order_id=p_order_id AND wp.side='sell')
    OR EXISTS (
      SELECT 1 FROM public.order_line_items wp
      LEFT JOIN public.order_line_items origin ON origin.id=wp.origin_line_item_id
      WHERE wp.order_id=p_order_id AND wp.side='sell'
        AND (wp.origin_line_item_id IS NULL OR wp.work_package_quantity IS NULL OR wp.work_package_quantity<=0
          OR origin.id IS NULL OR origin.order_id<>v_origin OR origin.side<>'sell' OR origin.origin_line_item_id IS NOT NULL)
    ) THEN RAISE EXCEPTION 'WORK_PACKAGE_REQUIRED'; END IF;
  IF p_deadline<=now() THEN RAISE EXCEPTION 'RFQ_DEADLINE_INVALID'; END IF;
  IF coalesce(array_length(p_candidate_ids,1),0)<2 OR array_length(p_candidate_ids,1)<>(SELECT count(DISTINCT x) FROM unnest(p_candidate_ids)x) THEN RAISE EXCEPTION 'RFQ_CANDIDATES_INVALID'; END IF;
  IF v_order.buyer_organisation_id=ANY(p_candidate_ids) THEN RAISE EXCEPTION 'SELF_DEAL'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_candidate_ids)x LEFT JOIN public.organisations o ON o.id=x WHERE o.id IS NULL OR NOT o.is_active OR NOT (o.is_supplier OR o.is_producer OR o.is_trader OR o.is_manufacturer)) THEN RAISE EXCEPTION 'SELLER_INELIGIBLE'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_rfqs WHERE order_id=p_order_id AND status='open') THEN RAISE EXCEPTION 'RFQ_ALREADY_OPEN'; END IF;
  INSERT INTO public.project_rfqs(organization_id,order_id,deadline,created_by)
    VALUES(v_order.buyer_organisation_id,p_order_id,p_deadline,public.current_portal_user_id()) RETURNING id INTO v_rfq;
  FOREACH v_candidate IN ARRAY p_candidate_ids LOOP
    INSERT INTO public.project_rfq_candidates(organization_id,rfq_id) VALUES(v_candidate,v_rfq);
  END LOOP;
  RETURN v_rfq;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_project_rfq(p_rfq_id UUID,p_candidate_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.project_rfqs%ROWTYPE; c public.project_rfq_candidates%ROWTYPE; o public.orders%ROWTYPE; v_over BOOLEAN;
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM public.project_rfqs WHERE id=p_rfq_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RFQ_NOT_FOUND'; END IF;
  IF r.status<>'open' THEN RAISE EXCEPTION 'RFQ_NOT_OPEN'; END IF;
  IF r.deadline<=now() THEN RAISE EXCEPTION 'RFQ_EXPIRED'; END IF;
  PERFORM 1 FROM public.project_rfq_candidates
    WHERE rfq_id=p_rfq_id ORDER BY id FOR UPDATE;
  SELECT * INTO c FROM public.project_rfq_candidates
    WHERE id=p_candidate_id AND rfq_id=p_rfq_id;
  IF NOT FOUND OR c.status<>'submitted' THEN RAISE EXCEPTION 'CANDIDATE_NOT_SUBMITTED'; END IF;
  SELECT * INTO o FROM public.orders WHERE id=r.order_id FOR UPDATE;
  IF NOT FOUND OR o.lifecycle_stage<>'draft' THEN RAISE EXCEPTION 'LEG_NOT_DRAFT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(o.spine_id::text,0));
  IF o.buyer_organisation_id IS NULL OR o.seller_organisation_id IS NOT NULL THEN RAISE EXCEPTION 'SELLER_PLACEHOLDER_REQUIRED'; END IF;
  IF c.organization_id=o.buyer_organisation_id THEN RAISE EXCEPTION 'SELF_DEAL'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id=c.organization_id AND is_active AND (is_supplier OR is_producer OR is_trader OR is_manufacturer)) THEN RAISE EXCEPTION 'SELLER_INELIGIBLE'; END IF;

  -- All affected origins first, then every package referencing those origins.
  -- Both sets use UUID order, giving every concurrent award the same lock order.
  PERFORM 1 FROM public.order_line_items origin
  WHERE origin.id IN (SELECT wp.origin_line_item_id FROM public.order_line_items wp WHERE wp.order_id=o.id)
  ORDER BY origin.id FOR UPDATE;
  PERFORM 1 FROM public.order_line_items wp
  WHERE wp.origin_line_item_id IN (SELECT own.origin_line_item_id FROM public.order_line_items own WHERE own.order_id=o.id)
  ORDER BY wp.origin_line_item_id,wp.id FOR UPDATE;

  SELECT EXISTS (
    SELECT 1
    FROM public.order_line_items origin
    JOIN public.order_line_items own ON own.order_id=o.id AND own.origin_line_item_id=origin.id
    WHERE (
      SELECT coalesce(sum(w.work_package_quantity),0)
      FROM public.order_line_items w JOIN public.orders d ON d.id=w.order_id
      WHERE w.origin_line_item_id=origin.id AND d.lifecycle_stage<>'cancelled'
        AND d.buyer_organisation_id IS NOT NULL AND d.seller_organisation_id IS NOT NULL
    ) + own.work_package_quantity >
      public.project_origin_required_quantity(origin.volume_m3,origin.pieces)
  ) INTO v_over;
  IF v_over THEN RAISE EXCEPTION 'WORK_PACKAGE_OVER_ALLOCATED'; END IF;

  UPDATE public.orders SET seller_organisation_id=c.organization_id,deal_kind='buy_sell',
    value_cents=c.quote_total_cents WHERE id=o.id;
  PERFORM public.mint_project_deal_code(o.id);
  UPDATE public.project_rfq_candidates SET status=CASE WHEN id=c.id THEN 'awarded' ELSE 'not_awarded' END WHERE rfq_id=r.id;
  UPDATE public.project_rfqs SET status='awarded',awarded_candidate_id=c.id WHERE id=r.id;
  RETURN o.id;
END;
$$;

REVOKE ALL ON FUNCTION public.spine_origin_order_id(UUID), public.mint_project_deal_code(UUID), public.project_origin_required_quantity(NUMERIC,TEXT),
  public.create_same_spine_project_leg(UUID,UUID,UUID,JSONB), public.complete_project_leg_party(UUID,TEXT,UUID),
  public.get_spine_origin_allocation(UUID), public.create_project_rfq(UUID,UUID[],TIMESTAMPTZ),
  public.award_project_rfq(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_same_spine_project_leg(UUID,UUID,UUID,JSONB),
  public.complete_project_leg_party(UUID,TEXT,UUID), public.get_spine_origin_allocation(UUID),
  public.create_project_rfq(UUID,UUID[],TIMESTAMPTZ), public.award_project_rfq(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spine_origin_order_id(UUID), public.mint_project_deal_code(UUID), public.project_origin_required_quantity(NUMERIC,TEXT) TO service_role;
