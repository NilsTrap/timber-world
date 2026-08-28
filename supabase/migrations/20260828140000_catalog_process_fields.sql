-- Catalogue process fields and immutable, price-free project snapshots.
ALTER TABLE public.catalog_category_field_assignments DROP CONSTRAINT IF EXISTS catalog_category_field_assignments_applies_to_check;
ALTER TABLE public.catalog_category_field_assignments ADD CONSTRAINT catalog_category_field_assignments_applies_to_check CHECK (applies_to IN ('product', 'variant', 'process'));

INSERT INTO public.catalog_fields (field_key,field_label,field_type,unit) VALUES
('sheets','Sheets','number',NULL),('metal','Metal','number',NULL),('cutting','Cutting','number',NULL),
('bending','Bending','number',NULL),('straightening','Straightening','number',NULL),('countersinking','Countersinking','number',NULL),
('rolling','Rolling','number',NULL),('welding','Welding','number',NULL),('galvanizing','Galvanizing','number',NULL),
('tubes','Tubes','number',NULL),('painting','Painting','number',NULL),('shot_blasting','Shot blasting','number',NULL),
('powder_priming','Powder priming','number',NULL),('powder_coating','Powder coating','number',NULL),
('wet_priming','Wet priming','number',NULL),('wet_painting','Wet painting','number',NULL),
('packaging','Packaging','number',NULL),('transport','Transport','number',NULL)
ON CONFLICT (field_key) DO NOTHING;

CREATE TABLE public.order_line_item_process_requirements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_line_item_id UUID NOT NULL REFERENCES public.order_line_items(id) ON DELETE CASCADE,
 field_key TEXT NOT NULL CHECK(length(field_key) BETWEEN 1 AND 100), name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 value TEXT NOT NULL CHECK(length(value) BETWEEN 1 AND 500 AND btrim(value)<>''), unit TEXT CHECK(unit IS NULL OR length(unit)<=50),
 sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN -100000 AND 100000), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(order_line_item_id,field_key));
CREATE INDEX idx_order_line_item_process_requirements_line ON public.order_line_item_process_requirements(order_line_item_id,sort_order,field_key);
ALTER TABLE public.order_line_item_process_requirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_line_item_process_requirements FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_project_process_requirements(p_line_ids UUID[])
RETURNS TABLE(request_line_id UUID,id UUID,field_key TEXT,name TEXT,value TEXT,unit TEXT,sort_order INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(cardinality(p_line_ids),0)>200 THEN RAISE EXCEPTION 'TOO_MANY_LINES'; END IF;
 RETURN QUERY WITH RECURSIVE ancestry AS (
  SELECT l.id request_id,l.id,l.origin_line_item_id,0 depth,ARRAY[l.id] visited FROM public.order_line_items l JOIN public.orders d ON d.id=l.order_id
  WHERE l.id=ANY(coalesce(p_line_ids,ARRAY[]::UUID[])) AND (public.is_current_user_platform_admin() OR public.current_user_in_org(d.buyer_organisation_id) OR public.current_user_in_org(d.seller_organisation_id))
  UNION ALL SELECT a.request_id,p.id,p.origin_line_item_id,a.depth+1,a.visited||p.id FROM ancestry a JOIN public.order_line_items p ON p.id=a.origin_line_item_id WHERE a.depth<50 AND NOT p.id=ANY(a.visited)
 ), roots AS (SELECT DISTINCT ON(request_id) request_id,id root_id FROM ancestry ORDER BY request_id,depth DESC,id)
 SELECT r.request_id,pr.id,pr.field_key,pr.name,pr.value,pr.unit,pr.sort_order FROM roots r JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=r.root_id
 ORDER BY r.request_id,pr.sort_order,pr.field_key,pr.id;
END $$;

CREATE OR REPLACE FUNCTION public.create_project_specification_line_with_processes(p_order_id UUID,p_catalog_variant_id UUID,p_line JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.orders%ROWTYPE; v public.catalog_variants%ROWTYPE; product public.catalog_products%ROWTYPE; category public.catalog_categories%ROWTYPE;
 new_id UUID; next_no INTEGER; resolved_value TEXT; assignment RECORD;
BEGIN
 IF p_line IS NULL OR jsonb_typeof(p_line)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p_line))>10 THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_line) k WHERE k NOT IN ('product_name','product_type','thickness','width','length','pieces','volume_m3','unit','notes','is_standard')) THEN RAISE EXCEPTION 'INVALID_LINE_FIELD'; END IF;
 IF length(coalesce(p_line->>'product_name','')) NOT BETWEEN 1 AND 200 OR length(coalesce(p_line->>'product_type',''))>200
  OR length(coalesce(p_line->>'thickness',''))>100 OR length(coalesce(p_line->>'width',''))>100 OR length(coalesce(p_line->>'length',''))>100
 OR length(coalesce(p_line->>'pieces',''))>100 OR length(coalesce(p_line->>'volume_m3',''))>100 OR length(coalesce(p_line->>'notes',''))>2000
  OR p_line->>'unit' NOT IN ('m3','m2','piece','linear_m','package','crate','loose_m3')
 OR coalesce(nullif(p_line->>'pieces','')::numeric,nullif(p_line->>'volume_m3','')::numeric,0) NOT BETWEEN 0.0001 AND 1000000000 THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
 SELECT * INTO d FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
 IF d.deal_kind NOT IN ('buy_sell','sale_only') THEN RAISE EXCEPTION 'ROOT_PROJECT_REQUIRED'; END IF;
 IF d.lifecycle_stage<>'draft' THEN RAISE EXCEPTION 'PROJECT_NOT_DRAFT'; END IF;
 IF NOT(public.is_current_user_platform_admin() OR (public.current_user_in_org(d.seller_organisation_id) AND public.current_user_deal_terms_access(d.seller_organisation_id,true))) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_catalog_variant_id IS NULL THEN RAISE EXCEPTION 'CATALOG_VARIANT_REQUIRED'; END IF;
 SELECT * INTO v FROM public.catalog_variants WHERE id=p_catalog_variant_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'CATALOG_VARIANT_INVALID'; END IF;
 SELECT * INTO product FROM public.catalog_products WHERE id=v.product_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'CATALOG_PRODUCT_INVALID'; END IF;
 SELECT * INTO category FROM public.catalog_categories WHERE id=product.category_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'CATALOG_CATEGORY_INVALID'; END IF;
 IF category.primary_unit<>p_line->>'unit' THEN RAISE EXCEPTION 'CATALOG_UNIT_MISMATCH'; END IF;
 IF (SELECT count(*) FROM public.catalog_category_field_assignments a WHERE a.category_id=category.id AND a.applies_to='process')>200
   THEN RAISE EXCEPTION 'TOO_MANY_PROCESS_FIELDS'; END IF;
 SELECT coalesce(max(line_no),0)+1 INTO next_no FROM public.order_line_items WHERE order_id=p_order_id AND side='sell';
 INSERT INTO public.order_line_items(order_id,side,line_no,product_name,product_type,thickness,width,length,pieces,volume_m3,unit,unit_price_cents,line_total_cents,notes,catalog_product_id,catalog_variant_id,is_standard)
 VALUES(p_order_id,'sell',next_no,product.name,v.sku,CASE WHEN v.thickness_mm IS NULL THEN NULL ELSE v.thickness_mm::TEXT END,
  CASE WHEN v.width_mm IS NULL THEN NULL ELSE v.width_mm::TEXT END,CASE WHEN v.length_mm IS NULL THEN NULL ELSE v.length_mm::TEXT END,
  p_line->>'pieces',nullif(p_line->>'volume_m3','')::numeric,p_line->>'unit',NULL,NULL,nullif(btrim(p_line->>'notes'),''),product.id,v.id,true) RETURNING id INTO new_id;
 FOR assignment IN SELECT a.sort_order,a.is_required,f.field_key,f.field_label,f.unit,
   coalesce(o.label,pfv.value_text,CASE WHEN pfv.value_number IS NULL THEN NULL ELSE pfv.value_number::TEXT END) value
  FROM public.catalog_category_field_assignments a JOIN public.catalog_fields f ON f.id=a.field_id
  LEFT JOIN public.catalog_product_field_values pfv ON pfv.product_id=product.id AND pfv.field_id=f.id
  LEFT JOIN public.catalog_field_options o ON o.id=pfv.option_id AND o.field_id=f.id AND o.is_active
  WHERE a.category_id=category.id AND a.applies_to='process' ORDER BY a.sort_order,f.field_key,f.id
 LOOP
  resolved_value:=nullif(btrim(assignment.value),'');
  IF resolved_value IS NULL THEN IF assignment.is_required THEN RAISE EXCEPTION 'REQUIRED_PROCESS_VALUE_MISSING:%',assignment.field_key; END IF; CONTINUE; END IF;
  IF length(resolved_value)>500 OR length(assignment.field_label)>200 OR length(assignment.field_key)>100 OR length(coalesce(assignment.unit,''))>50 THEN RAISE EXCEPTION 'PROCESS_VALUE_TOO_LONG'; END IF;
  INSERT INTO public.order_line_item_process_requirements(order_line_item_id,field_key,name,value,unit,sort_order)
  VALUES(new_id,assignment.field_key,assignment.field_label,resolved_value,assignment.unit,assignment.sort_order);
 END LOOP; RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_project_rfq_candidate_snapshot(p_order_id UUID) RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('id',o.id,'reference',coalesce(o.deal_code,o.code),'name',o.name,'stage',o.lifecycle_stage,'deliveryDeadline',o.delivery_deadline,'currency',o.currency,
 'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'lineNo',l.line_no,'productName',l.product_name,'woodSpecies',l.wood_species,'humidity',l.humidity,'processing',l.processing,
 'quality',l.quality,'thickness',l.thickness,'width',l.width,'length',l.length,'pieces',l.pieces,'volumeM3',l.volume_m3,'unit',l.unit,'notes',l.notes,
 'processRequirements',coalesce((WITH RECURSIVE ancestry AS (
   SELECT l.id id,l.origin_line_item_id,0 depth,ARRAY[l.id] visited UNION ALL
   SELECT parent.id,parent.origin_line_item_id,a.depth+1,a.visited||parent.id FROM ancestry a JOIN public.order_line_items parent ON parent.id=a.origin_line_item_id
   WHERE a.depth<50 AND NOT parent.id=ANY(a.visited)), root AS (SELECT id FROM ancestry ORDER BY depth DESC,id LIMIT 1)
   SELECT jsonb_agg(jsonb_build_object('id',pr.id,'fieldKey',pr.field_key,'name',pr.name,'value',pr.value,'unit',pr.unit) ORDER BY pr.sort_order,pr.field_key,pr.id)
   FROM root JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=root.id),'[]'::jsonb))
 ORDER BY l.line_no,l.id) FROM public.order_line_items l WHERE l.order_id=o.id AND l.side='sell'),'[]'::jsonb))
 FROM public.orders o WHERE o.id=p_order_id AND EXISTS(SELECT 1 FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.rfq_id=r.id
 WHERE r.order_id=o.id AND r.status='open' AND r.deadline>now() AND public.current_user_in_org(c.organization_id))
$$;

REVOKE ALL ON FUNCTION public.get_project_process_requirements(UUID[]),public.create_project_specification_line_with_processes(UUID,UUID,JSONB),public.get_project_rfq_candidate_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_process_requirements(UUID[]),public.create_project_specification_line_with_processes(UUID,UUID,JSONB),public.get_project_rfq_candidate_snapshot(UUID) TO authenticated;
