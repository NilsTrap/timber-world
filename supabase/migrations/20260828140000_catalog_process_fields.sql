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

CREATE OR REPLACE FUNCTION public.validate_process_field_assignment() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE process_type TEXT;
BEGIN
 IF NEW.applies_to<>'process' THEN RETURN NEW; END IF;
 SELECT f.field_type INTO process_type FROM public.catalog_fields f WHERE f.id=NEW.field_id;
 IF process_type IS NULL THEN RAISE EXCEPTION 'PROCESS_FIELD_NOT_FOUND'; END IF;
 IF process_type IN ('boolean','file') THEN RAISE EXCEPTION 'UNSUPPORTED_PROCESS_FIELD_TYPE'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_process_field_assignment ON public.catalog_category_field_assignments;
CREATE TRIGGER validate_process_field_assignment BEFORE INSERT OR UPDATE OF applies_to,field_id
ON public.catalog_category_field_assignments FOR EACH ROW EXECUTE FUNCTION public.validate_process_field_assignment();

CREATE OR REPLACE FUNCTION public.resolve_project_process_root(p_line_id UUID) RETURNS UUID
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE current_id UUID:=p_line_id; parent_id UUID; current_order UUID; current_spine UUID; parent_order UUID; parent_spine UUID; visited UUID[]:=ARRAY[p_line_id]; depth INTEGER:=0;
BEGIN
 SELECT l.order_id,d.spine_id INTO current_order,current_spine FROM public.order_line_items l JOIN public.orders d ON d.id=l.order_id WHERE l.id=p_line_id;
 IF current_order IS NULL THEN RAISE EXCEPTION 'LINE_NOT_FOUND'; END IF;
 LOOP
  SELECT l.origin_line_item_id INTO parent_id FROM public.order_line_items l WHERE l.id=current_id;
  IF parent_id IS NULL THEN RETURN current_id; END IF;
  depth:=depth+1; IF depth>50 OR parent_id=ANY(visited) THEN RAISE EXCEPTION 'INVALID_LINE_ANCESTRY'; END IF;
  SELECT l.order_id,d.spine_id INTO parent_order,parent_spine FROM public.order_line_items l JOIN public.orders d ON d.id=l.order_id WHERE l.id=parent_id;
  IF parent_order IS NULL OR NOT ((current_spine IS NOT NULL AND parent_spine=current_spine) OR (current_spine IS NULL AND parent_order=current_order)) THEN RAISE EXCEPTION 'INVALID_LINE_ANCESTRY'; END IF;
  visited:=visited||parent_id; current_id:=parent_id;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.resolve_project_process_root(UUID) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_project_process_requirements(p_line_ids UUID[])
RETURNS TABLE(request_line_id UUID,id UUID,field_key TEXT,name TEXT,value TEXT,unit TEXT,sort_order INTEGER)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(cardinality(p_line_ids),0)>200 THEN RAISE EXCEPTION 'TOO_MANY_LINES'; END IF;
 IF EXISTS(WITH RECURSIVE walk AS (
  SELECT l.id request_id,l.id,l.origin_line_item_id,l.order_id,d.spine_id,0 depth,ARRAY[l.id] visited,false cycle,true scope_valid
  FROM public.order_line_items l JOIN public.orders d ON d.id=l.order_id WHERE l.id=ANY(coalesce(p_line_ids,ARRAY[]::UUID[]))
  UNION ALL
  SELECT w.request_id,p.id,p.origin_line_item_id,p.order_id,pd.spine_id,w.depth+1,w.visited||p.id,p.id=ANY(w.visited),
   ((w.spine_id IS NOT NULL AND pd.spine_id=w.spine_id) OR (w.spine_id IS NULL AND p.order_id=w.order_id))
  FROM walk w JOIN public.order_line_items p ON p.id=w.origin_line_item_id JOIN public.orders pd ON pd.id=p.order_id
  WHERE w.depth<50 AND NOT w.cycle AND w.scope_valid
 ) SELECT 1 FROM walk WHERE cycle OR NOT scope_valid OR (depth=50 AND origin_line_item_id IS NOT NULL)) THEN RAISE EXCEPTION 'INVALID_LINE_ANCESTRY'; END IF;
 RETURN QUERY WITH RECURSIVE ancestry AS (
  SELECT l.id request_id,l.id line_id,l.origin_line_item_id,l.order_id,d.spine_id,0 depth,ARRAY[l.id] visited FROM public.order_line_items l JOIN public.orders d ON d.id=l.order_id
  WHERE l.id=ANY(coalesce(p_line_ids,ARRAY[]::UUID[])) AND (public.is_current_user_platform_admin() OR public.current_user_in_org(d.buyer_organisation_id) OR public.current_user_in_org(d.seller_organisation_id))
  UNION ALL SELECT a.request_id,p.id,p.origin_line_item_id,p.order_id,pd.spine_id,a.depth+1,a.visited||p.id FROM ancestry a JOIN public.order_line_items p ON p.id=a.origin_line_item_id JOIN public.orders pd ON pd.id=p.order_id
  WHERE a.depth<50 AND NOT p.id=ANY(a.visited) AND ((a.spine_id IS NOT NULL AND pd.spine_id=a.spine_id) OR (a.spine_id IS NULL AND p.order_id=a.order_id))
 ), roots AS (SELECT DISTINCT ON(request_id) request_id,line_id root_id FROM ancestry ORDER BY request_id,depth DESC,line_id)
 SELECT r.request_id,pr.id,pr.field_key,pr.name,pr.value,pr.unit,pr.sort_order FROM roots r JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=r.root_id
 ORDER BY r.request_id,pr.sort_order,pr.field_key,pr.id;
END $$;

CREATE OR REPLACE FUNCTION public.create_project_specification_line_with_processes(p_order_id UUID,p_catalog_variant_id UUID,p_quantity NUMERIC,p_unit TEXT,p_notes TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.orders%ROWTYPE; v public.catalog_variants%ROWTYPE; product public.catalog_products%ROWTYPE; category public.catalog_categories%ROWTYPE;
 new_id UUID; next_no INTEGER; resolved_value TEXT; assignment RECORD;
BEGIN
 IF p_unit NOT IN ('m3','m2','piece','linear_m','package','crate','loose_m3') OR length(coalesce(p_notes,''))>2000 THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
 IF p_quantity IS NULL OR p_quantity<=0 OR p_quantity>(CASE WHEN p_unit IN ('piece','package','crate') THEN 1000000 ELSE 100000000 END)
  OR (p_unit IN ('piece','package','crate') AND trunc(p_quantity)<>p_quantity) THEN RAISE EXCEPTION 'INVALID_QUANTITY_FOR_UNIT'; END IF;
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
 IF category.primary_unit<>p_unit THEN RAISE EXCEPTION 'CATALOG_UNIT_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM public.catalog_category_field_assignments a JOIN public.catalog_fields f ON f.id=a.field_id
   WHERE a.category_id=category.id AND a.applies_to='process' AND f.field_type IN ('boolean','file'))
   THEN RAISE EXCEPTION 'UNSUPPORTED_PROCESS_FIELD_TYPE'; END IF;
 IF (SELECT count(*) FROM public.catalog_category_field_assignments a WHERE a.category_id=category.id AND a.applies_to='process')>200
   THEN RAISE EXCEPTION 'TOO_MANY_PROCESS_FIELDS'; END IF;
 SELECT coalesce(max(line_no),0)+1 INTO next_no FROM public.order_line_items WHERE order_id=p_order_id AND side='sell';
 INSERT INTO public.order_line_items(order_id,side,line_no,product_name,product_type,thickness,width,length,pieces,volume_m3,unit,unit_price_cents,line_total_cents,notes,catalog_product_id,catalog_variant_id,is_standard)
 VALUES(p_order_id,'sell',next_no,product.name,v.sku,CASE WHEN v.thickness_mm IS NULL THEN NULL ELSE v.thickness_mm::TEXT END,
  CASE WHEN v.width_mm IS NULL THEN NULL ELSE v.width_mm::TEXT END,CASE WHEN v.length_mm IS NULL THEN NULL ELSE v.length_mm::TEXT END,
  CASE WHEN p_unit IN ('m3','loose_m3') THEN NULL ELSE p_quantity::TEXT END,CASE WHEN p_unit IN ('m3','loose_m3') THEN p_quantity ELSE NULL END,p_unit,NULL,NULL,nullif(btrim(p_notes),''),product.id,v.id,true) RETURNING id INTO new_id;
 FOR assignment IN SELECT a.sort_order,a.is_required,f.field_key,f.field_label,f.unit,
   coalesce(o.label,pfv.value_text,CASE WHEN pfv.value_number IS NULL THEN NULL ELSE pfv.value_number::TEXT END) value
  FROM public.catalog_category_field_assignments a JOIN public.catalog_fields f ON f.id=a.field_id AND f.field_type NOT IN ('boolean','file')
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
 'processRequirements',coalesce((WITH root AS (SELECT public.resolve_project_process_root(l.id) id)
   SELECT jsonb_agg(jsonb_build_object('id',pr.id,'fieldKey',pr.field_key,'name',pr.name,'value',pr.value,'unit',pr.unit) ORDER BY pr.sort_order,pr.field_key,pr.id)
   FROM root JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=root.id),'[]'::jsonb))
 ORDER BY l.line_no,l.id) FROM public.order_line_items l WHERE l.order_id=o.id AND l.side='sell'),'[]'::jsonb))
 FROM public.orders o WHERE o.id=p_order_id AND EXISTS(SELECT 1 FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.rfq_id=r.id
 WHERE r.order_id=o.id AND r.status='open' AND r.deadline>now() AND public.current_user_in_org(c.organization_id))
$$;

REVOKE ALL ON FUNCTION public.get_project_process_requirements(UUID[]),public.create_project_specification_line_with_processes(UUID,UUID,NUMERIC,TEXT,TEXT),public.get_project_rfq_candidate_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_process_requirements(UUID[]),public.create_project_specification_line_with_processes(UUID,UUID,NUMERIC,TEXT,TEXT),public.get_project_rfq_candidate_snapshot(UUID) TO authenticated;
