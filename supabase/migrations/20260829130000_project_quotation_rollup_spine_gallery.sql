-- Quotation workbench, explicit commercial roll-up, and spine-wide image designations.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS commercial_rollup_state TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS commercial_offer_scope TEXT,
  ADD COLUMN IF NOT EXISTS commercial_purchase_cost_cents BIGINT,
  ADD COLUMN IF NOT EXISTS commercial_adjustment_cents BIGINT,
  ADD COLUMN IF NOT EXISTS commercial_margin_mode TEXT,
  ADD COLUMN IF NOT EXISTS commercial_version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commercial_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commercial_stale_at TIMESTAMPTZ;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_commercial_rollup_state_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_commercial_rollup_state_check
  CHECK (commercial_rollup_state IN ('draft','confirmed','stale'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_commercial_offer_scope_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_commercial_offer_scope_check
  CHECK (commercial_offer_scope IS NULL OR commercial_offer_scope IN ('full','partial'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_commercial_amounts_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_commercial_amounts_check CHECK (
  (commercial_purchase_cost_cents IS NULL OR commercial_purchase_cost_cents >= 0)
  AND (commercial_adjustment_cents IS NULL OR commercial_adjustment_cents >= 0)
  AND commercial_version >= 0
);
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_commercial_margin_mode_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_commercial_margin_mode_check CHECK(commercial_margin_mode IS NULL OR commercial_margin_mode IN('amount','percentage'));

CREATE TABLE IF NOT EXISTS public.project_leg_commercial_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  source_order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  source_candidate_id UUID REFERENCES public.project_rfq_candidates(id) ON DELETE RESTRICT,
  origin_line_item_id UUID NOT NULL REFERENCES public.order_line_items(id) ON DELETE RESTRICT,
  selected_quantity NUMERIC NOT NULL CHECK (selected_quantity > 0),
  source_amount_cents BIGINT NOT NULL CHECK (source_amount_cents >= 0),
  source_version BIGINT NOT NULL CHECK (source_version >= 0),
  source_updated_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES public.portal_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(target_order_id,source_order_id,origin_line_item_id)
);

CREATE TABLE IF NOT EXISTS public.project_leg_commercial_lines (
  target_order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  origin_line_item_id UUID NOT NULL REFERENCES public.order_line_items(id) ON DELETE RESTRICT,
  offered_quantity NUMERIC NOT NULL CHECK (offered_quantity > 0),
  purchase_cost_cents BIGINT NOT NULL CHECK (purchase_cost_cents >= 0),
  adjustment_cents BIGINT NOT NULL CHECK (adjustment_cents >= 0),
  margin_cents BIGINT NOT NULL CHECK (margin_cents >= 0),
  offered_value_cents BIGINT NOT NULL CHECK (offered_value_cents >= 0),
  PRIMARY KEY(target_order_id,origin_line_item_id)
);

ALTER TABLE public.project_leg_commercial_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_leg_commercial_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_leg_commercial_sources,public.project_leg_commercial_lines FROM anon,authenticated;

-- Designations never change the owning order or storage path of a file.
CREATE TABLE IF NOT EXISTS public.spine_project_images (
  spine_id UUID NOT NULL REFERENCES public.spines(id) ON DELETE CASCADE,
  order_file_id UUID NOT NULL REFERENCES public.order_files(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 3),
  created_by UUID REFERENCES public.portal_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(spine_id,position),
  UNIQUE(spine_id,order_file_id)
);
ALTER TABLE public.spine_project_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spine_project_images FROM anon,authenticated;

-- Prefer origin-order designations, then stable sibling choices. Never move files.
WITH candidates AS (
  SELECT o.spine_id,f.id,f.storage_path,f.thumbnail_sort_order,f.created_at,s.origin_order_id,o.id order_id,
    row_number() OVER(PARTITION BY o.spine_id,f.storage_path ORDER BY CASE WHEN o.id=s.origin_order_id THEN 0 ELSE 1 END,coalesce(f.thumbnail_sort_order,4),f.created_at,f.id) storage_rank
  FROM public.order_files f JOIN public.orders o ON o.id=f.order_id JOIN public.spines s ON s.id=o.spine_id
  WHERE f.category='project' AND f.file_variant='original' AND f.lifecycle_status='ready' AND f.is_thumbnail AND f.mime_type LIKE 'image/%'
), ranked AS (
  SELECT spine_id,id,
    row_number() OVER (PARTITION BY spine_id ORDER BY
      CASE WHEN order_id=origin_order_id THEN 0 ELSE 1 END,
      coalesce(thumbnail_sort_order,4),created_at,id) position
  FROM candidates WHERE storage_rank=1
)
INSERT INTO public.spine_project_images(spine_id,order_file_id,position)
SELECT spine_id,id,position FROM ranked WHERE position<=3
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.mutate_spine_project_image(p_spine_id UUID,p_file_id UUID,p_action TEXT,p_created_by UUID DEFAULT NULL)
RETURNS SMALLINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing SMALLINT; slot SMALLINT; row RECORD;
BEGIN
  IF p_action NOT IN('add','remove','default') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_spine_id::TEXT,0));
  IF p_action='add' AND NOT EXISTS(SELECT 1 FROM public.order_files f JOIN public.orders o ON o.id=f.order_id WHERE f.id=p_file_id AND o.spine_id=p_spine_id AND f.category='project' AND f.file_variant='original' AND f.lifecycle_status='ready' AND f.mime_type LIKE 'image/%') THEN RAISE EXCEPTION 'INVALID_IMAGE'; END IF;
  SELECT position INTO existing FROM public.spine_project_images WHERE spine_id=p_spine_id AND order_file_id=p_file_id;
  IF p_action='add' THEN
    IF existing IS NOT NULL THEN RETURN existing; END IF;
    SELECT candidate INTO slot FROM generate_series(1,3) candidate WHERE NOT EXISTS(SELECT 1 FROM public.spine_project_images i WHERE i.spine_id=p_spine_id AND i.position=candidate) ORDER BY candidate LIMIT 1;
    IF slot IS NULL THEN RAISE EXCEPTION 'IMAGE_LIMIT'; END IF;
    INSERT INTO public.spine_project_images VALUES(p_spine_id,p_file_id,slot,p_created_by,now());RETURN slot;
  END IF;
  IF existing IS NULL THEN RAISE EXCEPTION 'IMAGE_NOT_FOUND'; END IF;
  CREATE TEMP TABLE image_order(order_file_id UUID,created_by UUID,created_at TIMESTAMPTZ) ON COMMIT DROP;
  INSERT INTO image_order SELECT order_file_id,created_by,created_at FROM public.spine_project_images
    WHERE spine_id=p_spine_id AND (p_action<>'remove' OR order_file_id<>p_file_id)
    ORDER BY CASE WHEN p_action='default' AND order_file_id=p_file_id THEN 0 ELSE 1 END,position,order_file_id;
  DELETE FROM public.spine_project_images WHERE spine_id=p_spine_id;
  slot:=1;FOR row IN SELECT * FROM image_order LOOP INSERT INTO public.spine_project_images VALUES(p_spine_id,row.order_file_id,slot,row.created_by,row.created_at);slot:=slot+1;END LOOP;
  RETURN CASE WHEN p_action='remove' THEN NULL ELSE 1 END;
END $$;
REVOKE ALL ON FUNCTION public.mutate_spine_project_image(UUID,UUID,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_spine_project_image(UUID,UUID,TEXT,UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.project_commercial_owner(p_order public.orders)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_current_user_platform_admin() OR (
    p_order.seller_organisation_id IS NOT NULL
    AND public.current_user_in_org(p_order.seller_organisation_id)
    AND public.current_user_can_create_deal_in_org(p_order.seller_organisation_id)
    AND EXISTS(SELECT 1 FROM public.organisations x WHERE x.id=p_order.seller_organisation_id AND x.is_active AND x.is_trader)
    AND NOT EXISTS(SELECT 1 FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.id=r.awarded_candidate_id
      WHERE r.order_id=p_order.id AND r.status='awarded' AND c.status='awarded' AND c.organization_id=p_order.seller_organisation_id)
  )
$$;
REVOKE ALL ON FUNCTION public.project_commercial_owner(public.orders) FROM PUBLIC,anon,authenticated;

-- Admin correction deliberately keeps one current snapshot; no revision-history table.
CREATE OR REPLACE FUNCTION public.correct_project_rfq_quote_entries(
  p_candidate_id UUID,p_entries JSONB,p_notes TEXT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_rfq_candidates%ROWTYPE; r public.project_rfqs%ROWTYPE;
  e JSONB; typ TEXT; target UUID; qty NUMERIC; canonical_qty NUMERIC; label TEXT; unit TEXT;
  price BIGINT; total NUMERIC:=0; normalized JSONB:='[]'::jsonb; seen TEXT[]:=ARRAY[]::TEXT[];
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_entries IS NULL OR jsonb_typeof(p_entries)<>'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'INVALID_ENTRIES'; END IF;
  IF length(coalesce(p_notes,''))>4000 THEN RAISE EXCEPTION 'INVALID_NOTES'; END IF;
  SELECT * INTO c FROM public.project_rfq_candidates WHERE id=p_candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CANDIDATE_NOT_FOUND'; END IF;
  SELECT * INTO r FROM public.project_rfqs WHERE id=c.rfq_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RFQ_NOT_FOUND'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended((SELECT spine_id::TEXT FROM public.orders WHERE id=r.order_id),0));
  PERFORM 1 FROM public.orders WHERE id=r.order_id FOR UPDATE;
  SELECT * INTO r FROM public.project_rfqs WHERE id=c.rfq_id FOR UPDATE;
  SELECT * INTO c FROM public.project_rfq_candidates WHERE id=p_candidate_id FOR UPDATE;
  FOR e IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    typ:=e->>'targetType';
    BEGIN target:=(e->>'targetId')::UUID; qty:=(e->>'quantity')::NUMERIC; price:=(e->>'unitPriceCents')::BIGINT;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INVALID_ENTRY'; END;
    IF typ NOT IN ('line','process') OR qty IS NULL OR qty<=0 OR price IS NULL OR price<0 OR typ||':'||target::TEXT=ANY(seen) THEN RAISE EXCEPTION 'INVALID_ENTRY'; END IF;
    seen:=array_append(seen,typ||':'||target::TEXT); canonical_qty:=NULL;
    IF typ='line' THEN
      SELECT public.project_origin_required_quantity(l.volume_m3,l.pieces),l.product_name,l.unit INTO canonical_qty,label,unit
      FROM public.order_line_items l WHERE l.id=target AND l.order_id=r.order_id AND l.side='sell';
    ELSE
      SELECT CASE WHEN pr.value~'^\s*[0-9]+([.][0-9]+)?\s*$' THEN trim(pr.value)::NUMERIC END,l.product_name||' · '||pr.name,coalesce(pr.unit,'unit')
      INTO canonical_qty,label,unit FROM public.order_line_items l
      JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=public.resolve_project_process_root(l.id)
      WHERE pr.id=target AND l.order_id=r.order_id AND l.side='sell';
    END IF;
    IF canonical_qty IS NULL OR qty<>canonical_qty THEN RAISE EXCEPTION 'STALE_REQUIREMENT'; END IF;
    total:=total+round(qty*price); IF total>9223372036854775807 THEN RAISE EXCEPTION 'TOTAL_TOO_LARGE'; END IF;
    normalized:=normalized||jsonb_build_array(jsonb_build_object('targetType',typ,'targetId',target,'label',label,'quantity',qty,'unit',unit,'unitPriceCents',price));
  END LOOP;
  UPDATE public.project_rfq_candidates SET quote_entries=normalized,quote_total_cents=total::BIGINT,
    quote_notes=nullif(trim(p_notes),''),status=CASE WHEN status='invited' THEN 'submitted' ELSE status END,
    submitted_at=coalesce(submitted_at,now()),quote_entered_by=public.current_portal_user_id(),quote_entered_as_admin=true
  WHERE id=c.id;
  IF c.status='awarded' THEN
    UPDATE public.orders SET commercial_rollup_state=CASE WHEN commercial_confirmed_at IS NULL AND resale_value_cents IS NULL THEN 'draft' ELSE 'stale' END,
      commercial_stale_at=CASE WHEN commercial_confirmed_at IS NULL AND resale_value_cents IS NULL THEN NULL ELSE now() END,
      updated_at=now()
    WHERE id=r.order_id;
    WITH RECURSIVE affected(id) AS (
      SELECT target_order_id FROM public.project_leg_commercial_sources WHERE source_order_id=r.order_id
      UNION SELECT s.target_order_id FROM public.project_leg_commercial_sources s JOIN affected a ON s.source_order_id=a.id
    ) UPDATE public.orders SET commercial_rollup_state='stale',commercial_stale_at=now(),updated_at=now() WHERE id IN(SELECT id FROM affected);
  END IF;
  RETURN total::BIGINT;
END $$;
REVOKE ALL ON FUNCTION public.correct_project_rfq_quote_entries(UUID,JSONB,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.correct_project_rfq_quote_entries(UUID,JSONB,TEXT) TO authenticated;

-- Private source projection. Source direction is source buyer = target seller.
CREATE OR REPLACE FUNCTION public.get_project_commercial_sources(p_target_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target public.orders%ROWTYPE; result JSONB;
BEGIN
  SELECT * INTO target FROM public.orders WHERE id=p_target_order_id;
  IF NOT FOUND OR target.spine_id IS NULL THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
  IF NOT public.project_commercial_owner(target) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT coalesce(jsonb_agg(source_payload ORDER BY source_payload->>'reference'),'[]'::jsonb) INTO result FROM (
    SELECT jsonb_build_object('sourceOrderId',s.id,'reference',coalesce(s.deal_code,s.code),
      'currency',s.currency,'sourceVersion',s.commercial_version,
      'sourceCandidateId',(SELECT c.id FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.id=r.awarded_candidate_id WHERE r.order_id=s.id AND r.status='awarded' AND c.status='awarded' ORDER BY r.created_at DESC LIMIT 1),
      'sourceUpdatedAt',coalesce((SELECT c.updated_at FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.id=r.awarded_candidate_id WHERE r.order_id=s.id AND r.status='awarded' AND c.status='awarded' ORDER BY r.created_at DESC LIMIT 1),s.updated_at),
      'sellerName',seller.name,'lines',coalesce(
        (SELECT jsonb_agg(jsonb_build_object('originLineItemId',cl.origin_line_item_id,'availableQuantity',cl.offered_quantity,'sourceAmountCents',cl.offered_value_cents) ORDER BY cl.origin_line_item_id)
         FROM public.project_leg_commercial_lines cl WHERE cl.target_order_id=s.id),
        (SELECT jsonb_agg(jsonb_build_object('originLineItemId',q.origin_id,
             'availableQuantity',q.available_quantity,'sourceAmountCents',coalesce(cost.amount_cents,0)) ORDER BY q.origin_id)
         FROM (SELECT coalesce(l.origin_line_item_id,l.id) origin_id,
                 sum(coalesce(l.work_package_quantity,public.project_origin_required_quantity(l.volume_m3,l.pieces))) available_quantity
               FROM public.order_line_items l WHERE l.order_id=s.id AND l.side='sell'
               GROUP BY coalesce(l.origin_line_item_id,l.id)) q
         JOIN (SELECT coalesce(l.origin_line_item_id,l.id) origin_id,
                 sum(round((e->>'quantity')::NUMERIC*(e->>'unitPriceCents')::BIGINT))::BIGINT amount_cents
               FROM public.project_rfqs rfq JOIN public.project_rfq_candidates c ON c.id=rfq.awarded_candidate_id
               CROSS JOIN LATERAL jsonb_array_elements(c.quote_entries) e
               JOIN public.order_line_items l ON l.order_id=s.id AND l.side='sell' AND (
                 (e->>'targetType'='line' AND l.id=(e->>'targetId')::UUID)
                 OR (e->>'targetType'='process' AND public.resolve_project_process_root(l.id)=(SELECT pr.order_line_item_id FROM public.order_line_item_process_requirements pr WHERE pr.id=(e->>'targetId')::UUID))
               ) WHERE rfq.order_id=s.id AND rfq.status='awarded' AND c.status='awarded'
               GROUP BY coalesce(l.origin_line_item_id,l.id)) cost USING(origin_id))
      ,'[]'::jsonb)) source_payload
    FROM public.orders s JOIN public.organisations seller ON seller.id=s.seller_organisation_id
    WHERE s.spine_id=target.spine_id AND s.id<>target.id
      AND s.buyer_organisation_id=target.seller_organisation_id
      AND (s.commercial_rollup_state='confirmed' OR (s.commercial_rollup_state<>'stale' AND EXISTS(SELECT 1 FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.id=r.awarded_candidate_id WHERE r.order_id=s.id AND r.status='awarded' AND c.status='awarded')))
  ) sources;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_project_commercial_sources(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_commercial_sources(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_project_commercial_rollup(
  p_target_order_id UUID,p_scope TEXT,p_sources JSONB,p_adjustment_cents BIGINT,
  p_margin_mode TEXT,p_margin_value NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target public.orders%ROWTYPE; available JSONB; item JSONB; source JSONB; line JSONB;
  source_id UUID; origin_id UUID; selected_qty NUMERIC; available_qty NUMERIC; available_amount BIGINT;
  reviewed_version BIGINT; reviewed_updated TIMESTAMPTZ; scaled BIGINT; purchase BIGINT:=0; v_margin BIGINT; v_sales BIGINT;
  required_qty NUMERIC; allocated BIGINT; delta BIGINT; total_weight NUMERIC; result JSONB;
BEGIN
  IF p_scope NOT IN('full','partial') OR p_sources IS NULL OR jsonb_typeof(p_sources)<>'array' OR jsonb_array_length(p_sources)<1
    OR p_adjustment_cents IS NULL OR p_adjustment_cents<0 OR p_margin_mode NOT IN('amount','percentage') OR p_margin_value IS NULL OR p_margin_value<0
  THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  SELECT * INTO target FROM public.orders WHERE id=p_target_order_id;
  IF NOT FOUND OR target.spine_id IS NULL THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(target.spine_id::TEXT,0));
  SELECT * INTO target FROM public.orders WHERE id=p_target_order_id FOR UPDATE;
  IF NOT public.project_commercial_owner(target) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_margin_mode='percentage' AND p_margin_value>=100 THEN RAISE EXCEPTION 'MARGIN_INVALID'; END IF;
  -- Target is locked first; all remaining entities use stable UUID ordering.
  PERFORM 1 FROM public.orders WHERE id IN(SELECT (value->>'sourceOrderId')::UUID FROM jsonb_array_elements(p_sources)) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.project_rfq_candidates WHERE id IN(
    SELECT c.id FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.id=r.awarded_candidate_id
    WHERE r.order_id IN(SELECT (value->>'sourceOrderId')::UUID FROM jsonb_array_elements(p_sources))
  ) ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_sources) requested
    JOIN LATERAL (SELECT nullif(source->>'sourceCandidateId','')::UUID candidate_id FROM jsonb_array_elements(public.get_project_commercial_sources(p_target_order_id)) source WHERE source->>'sourceOrderId'=requested->>'sourceOrderId') expected ON true
    LEFT JOIN public.project_rfq_candidates c ON c.id=expected.candidate_id
    WHERE expected.candidate_id IS NOT NULL AND c.id IS NULL) THEN RAISE EXCEPTION 'STALE_OR_INVALID_SOURCE'; END IF;
  PERFORM 1 FROM public.order_line_items WHERE id IN(SELECT (value->>'originLineItemId')::UUID FROM jsonb_array_elements(p_sources)) ORDER BY id FOR UPDATE;
  available:=public.get_project_commercial_sources(p_target_order_id);
  CREATE TEMP TABLE rollup_input(source_order_id UUID,source_candidate_id UUID,origin_line_id UUID,qty NUMERIC,cost BIGINT,source_version BIGINT,source_updated_at TIMESTAMPTZ,PRIMARY KEY(source_order_id,origin_line_id)) ON COMMIT DROP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_sources) LOOP
    BEGIN source_id:=(item->>'sourceOrderId')::UUID;origin_id:=(item->>'originLineItemId')::UUID;selected_qty:=(item->>'selectedQuantity')::NUMERIC;reviewed_version:=(item->>'sourceVersion')::BIGINT;reviewed_updated:=(item->>'sourceUpdatedAt')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INVALID_SOURCE'; END;
    IF selected_qty IS NULL OR selected_qty<=0 THEN RAISE EXCEPTION 'INVALID_SOURCE'; END IF;
    source:=NULL;line:=NULL;
    SELECT value INTO source FROM jsonb_array_elements(available) WHERE value->>'sourceOrderId'=source_id::TEXT;
    IF source IS NULL OR source->>'currency' IS DISTINCT FROM target.currency OR (source->>'sourceVersion')::BIGINT<>reviewed_version OR (source->>'sourceUpdatedAt')::TIMESTAMPTZ<>reviewed_updated THEN RAISE EXCEPTION 'STALE_OR_INVALID_SOURCE'; END IF;
    SELECT value INTO line FROM jsonb_array_elements(source->'lines') WHERE value->>'originLineItemId'=origin_id::TEXT;
    IF line IS NULL THEN RAISE EXCEPTION 'INVALID_SOURCE_LINE'; END IF;
    available_qty:=(line->>'availableQuantity')::NUMERIC;available_amount:=(line->>'sourceAmountCents')::BIGINT;
    IF selected_qty>available_qty THEN RAISE EXCEPTION 'SOURCE_QUANTITY_EXCEEDED'; END IF;
    scaled:=round(available_amount::NUMERIC*selected_qty/available_qty)::BIGINT;
    BEGIN INSERT INTO rollup_input VALUES(source_id,nullif(source->>'sourceCandidateId','')::UUID,origin_id,selected_qty,scaled,reviewed_version,reviewed_updated);
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_SOURCE_LINE'; END;
    IF purchase>9223372036854775807-scaled THEN RAISE EXCEPTION 'TOTAL_TOO_LARGE'; END IF;purchase:=purchase+scaled;
  END LOOP;
  CREATE TEMP TABLE target_requirements AS SELECT coalesce(t.origin_line_item_id,t.id) origin_line_id,
    sum(coalesce(t.work_package_quantity,public.project_origin_required_quantity(t.volume_m3,t.pieces))) required_qty
    FROM public.order_line_items t WHERE t.order_id=target.id AND t.side='sell' GROUP BY coalesce(t.origin_line_item_id,t.id);
  IF EXISTS(SELECT 1 FROM rollup_input i LEFT JOIN target_requirements t USING(origin_line_id) WHERE t.origin_line_id IS NULL) THEN RAISE EXCEPTION 'LINE_OUTSIDE_TARGET'; END IF;
  IF EXISTS(SELECT 1 FROM (SELECT origin_line_id,sum(qty) qty FROM rollup_input GROUP BY origin_line_id)i JOIN target_requirements t USING(origin_line_id) WHERE i.qty>t.required_qty) THEN RAISE EXCEPTION 'OVER_COVERAGE'; END IF;
  IF p_scope='full' THEN SELECT t.origin_line_id,t.required_qty-coalesce(i.qty,0) INTO origin_id,selected_qty FROM target_requirements t LEFT JOIN(SELECT origin_line_id,sum(qty)qty FROM rollup_input GROUP BY origin_line_id)i USING(origin_line_id) WHERE coalesce(i.qty,0)<>t.required_qty ORDER BY t.origin_line_id LIMIT 1;IF origin_id IS NOT NULL THEN RAISE EXCEPTION 'INCOMPLETE_COVERAGE line=% missing_quantity=%',origin_id,selected_qty;END IF; END IF;
  IF EXISTS(WITH RECURSIVE dependency(id) AS (SELECT source_order_id FROM rollup_input UNION SELECT s.source_order_id FROM public.project_leg_commercial_sources s JOIN dependency d ON s.target_order_id=d.id) SELECT 1 FROM dependency WHERE id=target.id) THEN RAISE EXCEPTION 'CIRCULAR_SOURCE'; END IF;
  IF purchase>9223372036854775807-p_adjustment_cents THEN RAISE EXCEPTION 'TOTAL_TOO_LARGE'; END IF;
  IF p_margin_mode='percentage' THEN v_sales:=round((purchase+p_adjustment_cents)::NUMERIC/(1-p_margin_value/100))::BIGINT;v_margin:=v_sales-purchase-p_adjustment_cents;
  ELSE v_margin:=round(p_margin_value)::BIGINT;IF v_margin>9223372036854775807-purchase-p_adjustment_cents THEN RAISE EXCEPTION 'TOTAL_TOO_LARGE';END IF;v_sales:=purchase+p_adjustment_cents+v_margin;END IF;
  CREATE TEMP TABLE rollup_lines AS SELECT origin_line_id,sum(qty)qty,sum(cost)::BIGINT cost,0::BIGINT adjustment,0::BIGINT margin FROM rollup_input GROUP BY origin_line_id;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM rollup_lines WHERE cost>0) THEN sum(cost) ELSE sum(qty) END INTO total_weight FROM rollup_lines;
  UPDATE rollup_lines SET adjustment=floor(p_adjustment_cents*(CASE WHEN EXISTS(SELECT 1 FROM rollup_lines WHERE cost>0) THEN cost ELSE qty END)/total_weight)::BIGINT,margin=floor(v_margin*(CASE WHEN EXISTS(SELECT 1 FROM rollup_lines WHERE cost>0) THEN cost ELSE qty END)/total_weight)::BIGINT;
  SELECT p_adjustment_cents-sum(adjustment) INTO delta FROM rollup_lines;UPDATE rollup_lines SET adjustment=adjustment+1 WHERE origin_line_id IN(SELECT origin_line_id FROM rollup_lines ORDER BY ((p_adjustment_cents*(CASE WHEN EXISTS(SELECT 1 FROM rollup_lines WHERE cost>0) THEN cost ELSE qty END)/total_weight)-adjustment)DESC,origin_line_id LIMIT delta);
  SELECT v_margin-sum(rollup_lines.margin) INTO delta FROM rollup_lines;UPDATE rollup_lines SET margin=margin+1 WHERE origin_line_id IN(SELECT origin_line_id FROM rollup_lines ORDER BY ((v_margin*(CASE WHEN EXISTS(SELECT 1 FROM rollup_lines WHERE cost>0) THEN cost ELSE qty END)/total_weight)-rollup_lines.margin)DESC,origin_line_id LIMIT delta);
  DELETE FROM public.project_leg_commercial_sources WHERE target_order_id=target.id;DELETE FROM public.project_leg_commercial_lines WHERE target_order_id=target.id;
  INSERT INTO public.project_leg_commercial_sources(target_order_id,source_order_id,source_candidate_id,origin_line_item_id,selected_quantity,source_amount_cents,source_version,source_updated_at,created_by)
    SELECT target.id,source_order_id,source_candidate_id,origin_line_id,qty,cost,source_version,source_updated_at,public.current_portal_user_id() FROM rollup_input;
  INSERT INTO public.project_leg_commercial_lines SELECT target.id,origin_line_id,qty,cost,adjustment,margin,cost+adjustment+margin FROM rollup_lines;
  UPDATE public.orders SET commercial_rollup_state='confirmed',commercial_offer_scope=p_scope,commercial_purchase_cost_cents=purchase,commercial_adjustment_cents=p_adjustment_cents,
    commercial_margin_mode=p_margin_mode,margin_amount_cents=v_margin,margin_percent=CASE WHEN v_sales=0 THEN 0 ELSE round(v_margin::NUMERIC/v_sales*100,4)END,resale_value_cents=v_sales,commercial_version=commercial_version+1,commercial_confirmed_at=now(),commercial_stale_at=NULL,updated_at=now() WHERE id=target.id;
  WITH RECURSIVE affected(id) AS (SELECT target_order_id FROM public.project_leg_commercial_sources WHERE source_order_id=target.id UNION SELECT s.target_order_id FROM public.project_leg_commercial_sources s JOIN affected a ON s.source_order_id=a.id) UPDATE public.orders SET commercial_rollup_state='stale',commercial_stale_at=now(),updated_at=now() WHERE id IN(SELECT id FROM affected) AND id<>target.id;
  SELECT jsonb_build_object('scope',p_scope,'state','confirmed','purchaseCostCents',purchase,'adjustmentCents',p_adjustment_cents,'marginAmountCents',v_margin,'salesAmountCents',v_sales,'lines',coalesce(jsonb_agg(jsonb_build_object('originLineItemId',origin_line_id,'offeredQuantity',qty,'purchaseCostCents',cost,'adjustmentCents',adjustment,'marginCents',rollup_lines.margin,'offeredValueCents',cost+adjustment+rollup_lines.margin)ORDER BY origin_line_id),'[]'::jsonb)) INTO result FROM rollup_lines;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_project_commercial_rollup(UUID,TEXT,JSONB,BIGINT,TEXT,NUMERIC) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_project_commercial_rollup(UUID,TEXT,JSONB,BIGINT,TEXT,NUMERIC) TO authenticated;

-- Keep the legacy single-award margin path consistent with commercial roll-ups.
CREATE OR REPLACE FUNCTION public.set_project_awarded_margin(p_order_id UUID,p_mode TEXT,p_value NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.orders%ROWTYPE;v_cost BIGINT;v_margin BIGINT;v_sales BIGINT;v_percent NUMERIC(7,4);
BEGIN
  IF p_mode NOT IN('amount','percentage') OR p_value IS NULL OR p_value<0 THEN RAISE EXCEPTION 'MARGIN_INVALID';END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id;IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_order.spine_id::TEXT,0));
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT(public.is_current_user_platform_admin() OR(v_order.buyer_organisation_id IS NOT NULL AND public.current_user_in_org(v_order.buyer_organisation_id) AND public.current_user_can_create_deal_in_org(v_order.buyer_organisation_id) AND EXISTS(SELECT 1 FROM public.organisations o WHERE o.id=v_order.buyer_organisation_id AND o.is_active AND o.is_trader)))THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  SELECT c.quote_total_cents INTO v_cost FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.id=r.awarded_candidate_id AND c.rfq_id=r.id AND c.status='awarded' WHERE r.order_id=p_order_id AND r.status='awarded' ORDER BY r.created_at DESC LIMIT 1;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'AWARDED_QUOTATION_REQUIRED';END IF;
  IF p_mode='percentage' THEN IF p_value>=100 THEN RAISE EXCEPTION 'MARGIN_PERCENT_INVALID';END IF;v_sales:=round(v_cost::NUMERIC/(1-p_value/100))::BIGINT;v_margin:=v_sales-v_cost;
  ELSE v_margin:=round(p_value)::BIGINT;IF v_margin>9223372036854775807-v_cost THEN RAISE EXCEPTION 'MARGIN_TOO_LARGE';END IF;v_sales:=v_cost+v_margin;END IF;
  v_percent:=CASE WHEN v_sales=0 THEN 0 ELSE round(v_margin::NUMERIC/v_sales*100,4)END;
  UPDATE public.orders SET margin_amount_cents=v_margin,margin_percent=v_percent,resale_value_cents=v_sales,
    commercial_rollup_state='confirmed',commercial_margin_mode=p_mode,commercial_purchase_cost_cents=v_cost,
    commercial_adjustment_cents=0,commercial_version=commercial_version+1,commercial_confirmed_at=now(),commercial_stale_at=NULL,updated_at=now() WHERE id=p_order_id;
  WITH RECURSIVE affected(id) AS(SELECT target_order_id FROM public.project_leg_commercial_sources WHERE source_order_id=p_order_id UNION SELECT s.target_order_id FROM public.project_leg_commercial_sources s JOIN affected a ON s.source_order_id=a.id)
    UPDATE public.orders SET commercial_rollup_state='stale',commercial_stale_at=now(),updated_at=now() WHERE id IN(SELECT id FROM affected) AND id<>p_order_id;
  RETURN jsonb_build_object('purchaseCostCents',v_cost,'marginAmountCents',v_margin,'marginPercent',v_percent,'salesAmountCents',v_sales);
END $$;
REVOKE ALL ON FUNCTION public.set_project_awarded_margin(UUID,TEXT,NUMERIC) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_project_awarded_margin(UUID,TEXT,NUMERIC) TO authenticated;

NOTIFY pgrst,'reload schema';
