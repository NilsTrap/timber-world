-- Applicability is independent from quantity: a process can be selected while
-- its quantity is still zero during specification drafting.
ALTER TABLE public.order_line_item_process_requirements
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_project_process_requirements(UUID[]);
CREATE FUNCTION public.get_project_process_requirements(p_line_ids UUID[])
RETURNS TABLE(request_line_id UUID,id UUID,field_key TEXT,name TEXT,value TEXT,unit TEXT,sort_order INTEGER,field_type TEXT,is_required BOOLEAN,is_active BOOLEAN)
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
 SELECT roots.request_id,pr.id,pr.field_key,pr.name,pr.value,pr.unit,pr.sort_order,pr.field_type,pr.is_required,pr.is_active
 FROM roots JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=roots.root_id
 ORDER BY roots.request_id,pr.sort_order,pr.field_key,pr.id;
END $$;
REVOKE ALL ON FUNCTION public.get_project_process_requirements(UUID[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_process_requirements(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_project_specification_process_applicability(
  p_order_id UUID,p_line_id UUID,p_process_states JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.orders%ROWTYPE; l public.order_line_items%ROWTYPE;
BEGIN
 IF p_process_states IS NULL OR jsonb_typeof(p_process_states)<>'array' OR jsonb_array_length(p_process_states)>200
   OR EXISTS(SELECT key FROM (SELECT i->>'key' key,count(*) occurrences FROM jsonb_array_elements(p_process_states) i GROUP BY i->>'key') x WHERE key IS NULL OR occurrences<>1)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_process_states) i WHERE jsonb_typeof(i->'active')<>'boolean')
 THEN RAISE EXCEPTION 'INVALID_PROCESS_STATES'; END IF;
 SELECT * INTO d FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
 IF d.lifecycle_stage<>'draft' THEN RAISE EXCEPTION 'PROJECT_NOT_DRAFT'; END IF;
 IF d.deal_kind NOT IN ('buy_sell','sale_only') THEN RAISE EXCEPTION 'ROOT_PROJECT_REQUIRED'; END IF;
 IF NOT(public.is_current_user_platform_admin() OR (public.current_user_in_org(d.seller_organisation_id) AND public.current_user_deal_terms_access(d.seller_organisation_id,true))) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO l FROM public.order_line_items WHERE id=p_line_id AND order_id=p_order_id AND side='sell' FOR UPDATE;
 IF NOT FOUND OR l.catalog_product_id IS NULL OR l.origin_line_item_id IS NOT NULL THEN RAISE EXCEPTION 'LINE_NOT_EDITABLE'; END IF;
 IF jsonb_array_length(p_process_states)<>(SELECT count(*) FROM public.order_line_item_process_requirements WHERE order_line_item_id=l.id)
   OR EXISTS(SELECT 1 FROM public.order_line_item_process_requirements r WHERE r.order_line_item_id=l.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_process_states) i WHERE i->>'key'=r.field_key))
 THEN RAISE EXCEPTION 'INVALID_PROCESS_KEYS'; END IF;
 UPDATE public.order_line_item_process_requirements r SET is_active=i.active
 FROM (SELECT value->>'key' key,(value->>'active')::boolean active FROM jsonb_array_elements(p_process_states)) i
 WHERE r.order_line_item_id=l.id AND r.field_key=i.key;
END $$;
REVOKE ALL ON FUNCTION public.update_project_specification_process_applicability(UUID,UUID,JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_project_specification_process_applicability(UUID,UUID,JSONB) TO authenticated;

DROP FUNCTION IF EXISTS public.update_project_specification_structured_values_with_applicability(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,JSONB);
CREATE OR REPLACE FUNCTION public.update_project_spec_values_and_applicability(
  p_order_id UUID,p_line_id UUID,p_version TIMESTAMPTZ,p_basic_values JSONB,p_process_values JSONB,p_process_states JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.update_project_specification_structured_values(p_order_id,p_line_id,p_version,p_basic_values,p_process_values);
 PERFORM public.update_project_specification_process_applicability(p_order_id,p_line_id,p_process_states);
END $$;
REVOKE ALL ON FUNCTION public.update_project_spec_values_and_applicability(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_project_spec_values_and_applicability(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_inactive_project_rfq_process_entries()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (TG_OP='INSERT' OR NEW.quote_entries IS DISTINCT FROM OLD.quote_entries) AND EXISTS(
   SELECT 1 FROM jsonb_array_elements(coalesce(NEW.quote_entries,'[]'::jsonb)) entry
   JOIN public.order_line_item_process_requirements process
     ON process.id=CASE WHEN entry->>'targetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN (entry->>'targetId')::uuid END
   WHERE entry->>'targetType'='process' AND NOT process.is_active
 ) THEN RAISE EXCEPTION 'INACTIVE_PROCESS_REQUIREMENT'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_inactive_project_rfq_process_entries ON public.project_rfq_candidates;
CREATE TRIGGER trg_guard_inactive_project_rfq_process_entries
BEFORE INSERT OR UPDATE OF quote_entries ON public.project_rfq_candidates
FOR EACH ROW EXECUTE FUNCTION public.guard_inactive_project_rfq_process_entries();

CREATE OR REPLACE FUNCTION public.get_project_rfq_candidate_snapshot(p_order_id UUID) RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('id',o.id,'reference',coalesce(o.deal_code,o.code),'name',o.name,'stage',o.lifecycle_stage,'deliveryDeadline',o.delivery_deadline,'currency',o.currency,
 'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'lineNo',l.line_no,'productName',l.product_name,'woodSpecies',l.wood_species,'humidity',l.humidity,'processing',l.processing,
 'quality',l.quality,'thickness',l.thickness,'width',l.width,'length',l.length,'pieces',l.pieces,'volumeM3',l.volume_m3,'unit',l.unit,'notes',l.notes,'basicProperties',public.project_line_specification_fields(l.id),
 'processRequirements',coalesce((WITH root AS (SELECT public.resolve_project_process_root(l.id) id)
   SELECT jsonb_agg(jsonb_build_object('id',pr.id,'fieldKey',pr.field_key,'name',pr.name,'value',pr.value,'unit',pr.unit,'active',pr.is_active) ORDER BY pr.sort_order,pr.field_key,pr.id)
   FROM root JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=root.id),'[]'::jsonb))
 ORDER BY l.line_no,l.id) FROM public.order_line_items l WHERE l.order_id=o.id AND l.side='sell'),'[]'::jsonb))
 FROM public.orders o WHERE o.id=p_order_id AND EXISTS(SELECT 1 FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.rfq_id=r.id
 WHERE r.order_id=o.id AND r.status='open' AND r.deadline>now() AND public.current_user_in_org(c.organization_id))
$$;
REVOKE ALL ON FUNCTION public.get_project_rfq_candidate_snapshot(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_rfq_candidate_snapshot(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
