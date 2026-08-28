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
 field_key TEXT NOT NULL,name TEXT NOT NULL,value TEXT NOT NULL CHECK (btrim(value)<>''),unit TEXT,sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(order_line_item_id,field_key));
CREATE INDEX idx_order_line_item_process_requirements_line ON public.order_line_item_process_requirements(order_line_item_id,sort_order,field_key);
ALTER TABLE public.order_line_item_process_requirements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.root_order_line_item_id(p_line_id UUID) RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH RECURSIVE ancestry AS (
  SELECT l.id,l.origin_line_item_id,0 depth FROM public.order_line_items l JOIN public.orders d ON d.id=l.order_id
   WHERE l.id=p_line_id AND (public.is_current_user_platform_admin() OR public.current_user_in_org(d.buyer_organisation_id)
    OR public.current_user_in_org(d.seller_organisation_id) OR EXISTS(SELECT 1 FROM public.project_rfqs r
     JOIN public.project_rfq_candidates c ON c.rfq_id=r.id WHERE r.order_id=d.id AND r.status='open' AND r.deadline>now()
      AND public.current_user_in_org(c.organization_id)))
  UNION ALL SELECT p.id,p.origin_line_item_id,a.depth+1 FROM ancestry a
   JOIN public.order_line_items p ON p.id=a.origin_line_item_id WHERE a.depth<50)
 SELECT id FROM ancestry ORDER BY depth DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_project_process_requirements(p_line_ids UUID[])
RETURNS TABLE(request_line_id UUID,id UUID,field_key TEXT,name TEXT,value TEXT,unit TEXT,sort_order INTEGER)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH RECURSIVE ancestry AS (
  SELECT l.id request_line_id,l.id,l.origin_line_item_id,0 depth FROM public.order_line_items l
  JOIN public.orders d ON d.id=l.order_id WHERE l.id=ANY(p_line_ids) AND (
   public.is_current_user_platform_admin() OR public.current_user_in_org(d.buyer_organisation_id) OR public.current_user_in_org(d.seller_organisation_id))
  UNION ALL SELECT a.request_line_id,p.id,p.origin_line_item_id,a.depth+1 FROM ancestry a
   JOIN public.order_line_items p ON p.id=a.origin_line_item_id WHERE a.depth<50
 ), roots AS (SELECT DISTINCT ON(request_line_id) request_line_id,id root_id FROM ancestry ORDER BY request_line_id,depth DESC)
 SELECT r.request_line_id,pr.id,pr.field_key,pr.name,pr.value,pr.unit,pr.sort_order FROM roots r
 JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=r.root_id
 ORDER BY r.request_line_id,pr.sort_order,pr.field_key
$$;

CREATE POLICY order_line_item_process_requirements_select ON public.order_line_item_process_requirements FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.order_line_items root_line JOIN public.order_line_items visible_line ON public.root_order_line_item_id(visible_line.id)=root_line.id
 JOIN public.orders deal ON deal.id=visible_line.order_id WHERE root_line.id=order_line_item_id AND (
 public.is_current_user_platform_admin() OR public.current_user_in_org(deal.buyer_organisation_id) OR public.current_user_in_org(deal.seller_organisation_id))));
CREATE POLICY order_line_item_process_requirements_insert ON public.order_line_item_process_requirements FOR INSERT TO authenticated WITH CHECK(
 btrim(value)<>'' AND EXISTS(SELECT 1 FROM public.order_line_items line JOIN public.orders deal ON deal.id=line.order_id
 WHERE line.id=order_line_item_id AND line.origin_line_item_id IS NULL AND deal.deal_kind<>'purchase_only' AND deal.lifecycle_stage='draft'
 AND (public.is_current_user_platform_admin() OR (public.current_user_in_org(deal.seller_organisation_id)
 AND public.current_user_deal_terms_access(deal.seller_organisation_id,true)))));

-- This guarded boundary makes root-line creation and every snapshot one transaction.
CREATE OR REPLACE FUNCTION public.create_project_specification_line_with_processes(p_order_id UUID,p_line JSONB,p_requirements JSONB DEFAULT '[]'::JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.orders%ROWTYPE; new_id UUID; next_no INTEGER; req JSONB;
BEGIN
 SELECT * INTO d FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
 IF d.deal_kind='purchase_only' THEN RAISE EXCEPTION 'ROOT_PROJECT_REQUIRED'; END IF;
 IF d.lifecycle_stage<>'draft' THEN RAISE EXCEPTION 'PROJECT_NOT_DRAFT'; END IF;
 IF NOT(public.is_current_user_platform_admin() OR (public.current_user_in_org(d.seller_organisation_id)
   AND public.current_user_deal_terms_access(d.seller_organisation_id,true))) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF jsonb_typeof(p_requirements)<>'array' THEN RAISE EXCEPTION 'INVALID_REQUIREMENTS'; END IF;
 IF btrim(coalesce(p_line->>'product_name',''))='' OR p_line->>'unit' NOT IN ('m3','m2','piece','linear_m','package','crate','loose_m3')
   OR coalesce(nullif(p_line->>'pieces','')::numeric,nullif(p_line->>'volume_m3','')::numeric,0)<=0 THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
 IF nullif(p_line->>'catalog_product_id','') IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.catalog_products product
   JOIN public.catalog_category_field_assignments assignment ON assignment.category_id=product.category_id AND assignment.applies_to='process' AND assignment.is_required
   JOIN public.catalog_fields field ON field.id=assignment.field_id
   WHERE product.id=(p_line->>'catalog_product_id')::uuid AND NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(p_requirements) supplied
     WHERE supplied->>'field_key'=field.field_key AND btrim(coalesce(supplied->>'value',''))<>''
   )
 ) THEN RAISE EXCEPTION 'REQUIRED_PROCESS_VALUE_MISSING'; END IF;
 SELECT coalesce(max(line_no),0)+1 INTO next_no FROM public.order_line_items WHERE order_id=p_order_id AND side='sell';
 INSERT INTO public.order_line_items(order_id,side,line_no,product_name,product_type,thickness,width,length,pieces,volume_m3,unit,
   unit_price_cents,line_total_cents,notes,catalog_product_id,catalog_variant_id,is_standard)
 VALUES(p_order_id,'sell',next_no,p_line->>'product_name',p_line->>'product_type',p_line->>'thickness',p_line->>'width',p_line->>'length',
   p_line->>'pieces',nullif(p_line->>'volume_m3','')::numeric,p_line->>'unit',NULL,NULL,p_line->>'notes',
   nullif(p_line->>'catalog_product_id','')::uuid,nullif(p_line->>'catalog_variant_id','')::uuid,coalesce((p_line->>'is_standard')::boolean,false)) RETURNING id INTO new_id;
 FOR req IN SELECT value FROM jsonb_array_elements(p_requirements) LOOP
  IF btrim(coalesce(req->>'field_key',''))='' OR btrim(coalesce(req->>'name',''))='' OR btrim(coalesce(req->>'value',''))='' THEN RAISE EXCEPTION 'INVALID_REQUIREMENT'; END IF;
  INSERT INTO public.order_line_item_process_requirements(order_line_item_id,field_key,name,value,unit,sort_order)
  VALUES(new_id,req->>'field_key',req->>'name',btrim(req->>'value'),nullif(req->>'unit',''),coalesce((req->>'sort_order')::integer,0));
 END LOOP; RETURN new_id;
END $$;

-- Candidate payloads always include a safely-defaulted, root-origin snapshot array.
CREATE OR REPLACE FUNCTION public.get_project_rfq_candidate_snapshot(p_order_id UUID) RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('id',o.id,'reference',coalesce(o.deal_code,o.code),'name',o.name,'stage',o.lifecycle_stage,
 'deliveryDeadline',o.delivery_deadline,'currency',o.currency,'lines',coalesce((SELECT jsonb_agg(jsonb_build_object(
 'id',l.id,'lineNo',l.line_no,'productName',l.product_name,'woodSpecies',l.wood_species,'humidity',l.humidity,'processing',l.processing,
 'quality',l.quality,'thickness',l.thickness,'width',l.width,'length',l.length,'pieces',l.pieces,'volumeM3',l.volume_m3,'unit',l.unit,'notes',l.notes,
 'processRequirements',coalesce((SELECT jsonb_agg(jsonb_build_object('id',pr.id,'fieldKey',pr.field_key,'name',pr.name,'value',pr.value,'unit',pr.unit)
 ORDER BY pr.sort_order,pr.field_key) FROM public.order_line_item_process_requirements pr WHERE pr.order_line_item_id=public.root_order_line_item_id(l.id)),'[]'::jsonb))
 ORDER BY l.line_no,l.id) FROM public.order_line_items l WHERE l.order_id=o.id AND l.side='sell'),'[]'::jsonb))
 FROM public.orders o WHERE o.id=p_order_id AND EXISTS(SELECT 1 FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.rfq_id=r.id
 WHERE r.order_id=o.id AND r.status='open' AND r.deadline>now() AND public.current_user_in_org(c.organization_id))
$$;

REVOKE ALL ON FUNCTION public.root_order_line_item_id(UUID),public.get_project_process_requirements(UUID[]),public.create_project_specification_line_with_processes(UUID,JSONB,JSONB),public.get_project_rfq_candidate_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.root_order_line_item_id(UUID),public.get_project_process_requirements(UUID[]),public.create_project_specification_line_with_processes(UUID,JSONB,JSONB),public.get_project_rfq_candidate_snapshot(UUID) TO authenticated;
