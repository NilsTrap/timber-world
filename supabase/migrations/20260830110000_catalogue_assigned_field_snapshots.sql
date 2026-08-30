-- Preserve every category-assigned field in project snapshots, even when the
-- catalogue has no preset value. Project-specific values remain isolated from
-- the catalogue and are editable only on a draft root specification.

ALTER TABLE public.order_line_item_process_requirements
  ADD COLUMN IF NOT EXISTS field_type TEXT NOT NULL DEFAULT 'number',
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.order_line_item_process_requirements
  DROP CONSTRAINT IF EXISTS order_line_item_process_requirements_field_type_check;
ALTER TABLE public.order_line_item_process_requirements
  ADD CONSTRAINT order_line_item_process_requirements_field_type_check
  CHECK (field_type IN ('number'));

CREATE OR REPLACE FUNCTION public.catalogue_basic_field_snapshot(
  p_product_id UUID,
  p_variant_id UUID
) RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'key', f.field_key,
    'label', f.field_label,
    'type', f.field_type,
    'unit', f.unit,
    'value', coalesce(vo.label, vv.value_text, vv.value_number::text,
                      vv.value_file_name, po.label, pv.value_text, pv.value_number::text,
                      pv.value_file_name, ''),
    'allowedOptions', CASE WHEN f.field_type='select' THEN coalesce((
      SELECT jsonb_agg(option_row.label ORDER BY option_row.sort_order,option_row.label)
      FROM public.catalog_field_options option_row
      WHERE option_row.field_id=f.id AND option_row.is_active
    ),'[]'::jsonb) ELSE '[]'::jsonb END,
    'sortOrder', a.sort_order,
    'required', a.is_required
  ) ORDER BY a.sort_order, f.field_key, f.id), '[]'::jsonb)
  FROM public.catalog_products p
  JOIN public.catalog_category_field_assignments a
    ON a.category_id=p.category_id AND a.applies_to<>'process'
  JOIN public.catalog_fields f ON f.id=a.field_id
  LEFT JOIN public.catalog_product_field_values pv
    ON pv.product_id=p.id AND pv.field_id=f.id
  LEFT JOIN public.catalog_field_options po
    ON po.id=pv.option_id AND po.field_id=f.id AND po.is_active
  LEFT JOIN public.catalog_variant_field_values vv
    ON vv.variant_id=p_variant_id AND vv.field_id=f.id
  LEFT JOIN public.catalog_field_options vo
    ON vo.id=vv.option_id AND vo.field_id=f.id AND vo.is_active
  WHERE p.id=p_product_id
$$;
REVOKE ALL ON FUNCTION public.catalogue_basic_field_snapshot(UUID,UUID) FROM PUBLIC,anon,authenticated;

-- Replace the catalogue import boundary so all process definitions are
-- materialized. Processes are quantitative requirements and therefore default
-- to zero until the project specification supplies a quantity.
CREATE OR REPLACE FUNCTION public.create_project_specification_line_with_processes(
  p_order_id UUID,p_catalog_variant_id UUID,p_quantity NUMERIC,p_unit TEXT,p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 d public.orders%ROWTYPE; v public.catalog_variants%ROWTYPE; product public.catalog_products%ROWTYPE;
 category public.catalog_categories%ROWTYPE; new_id UUID; next_no INTEGER; assignment RECORD; resolved_value TEXT;
BEGIN
 IF p_unit NOT IN ('kg','m3','m2','piece','linear_m','package','crate','loose_m3') OR length(coalesce(p_notes,''))>2000 THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
 IF p_quantity IS NULL OR p_quantity<=0 OR p_quantity>(CASE WHEN p_unit IN ('piece','package','crate') THEN 1000000 ELSE 100000000 END)
   OR (p_unit IN ('piece','package','crate') AND trunc(p_quantity)<>p_quantity) THEN RAISE EXCEPTION 'INVALID_QUANTITY_FOR_UNIT'; END IF;
 SELECT * INTO d FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
 IF d.deal_kind NOT IN ('buy_sell','sale_only') THEN RAISE EXCEPTION 'ROOT_PROJECT_REQUIRED'; END IF;
 IF d.lifecycle_stage<>'draft' THEN RAISE EXCEPTION 'PROJECT_NOT_DRAFT'; END IF;
 IF NOT(public.is_current_user_platform_admin() OR (public.current_user_in_org(d.seller_organisation_id) AND public.current_user_deal_terms_access(d.seller_organisation_id,true))) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO v FROM public.catalog_variants WHERE id=p_catalog_variant_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'CATALOG_VARIANT_INVALID'; END IF;
 SELECT * INTO product FROM public.catalog_products WHERE id=v.product_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'CATALOG_PRODUCT_INVALID'; END IF;
 SELECT * INTO category FROM public.catalog_categories WHERE id=product.category_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'CATALOG_CATEGORY_INVALID'; END IF;
 IF category.primary_unit<>p_unit THEN RAISE EXCEPTION 'CATALOG_UNIT_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM public.catalog_category_field_assignments a JOIN public.catalog_fields f ON f.id=a.field_id
   WHERE a.category_id=category.id AND a.applies_to='process' AND f.field_type<>'number') THEN RAISE EXCEPTION 'UNSUPPORTED_PROCESS_FIELD_TYPE'; END IF;
 IF (SELECT count(*) FROM public.catalog_category_field_assignments a WHERE a.category_id=category.id AND a.applies_to='process')>200 THEN RAISE EXCEPTION 'TOO_MANY_PROCESS_FIELDS'; END IF;
 SELECT coalesce(max(line_no),0)+1 INTO next_no FROM public.order_line_items WHERE order_id=p_order_id AND side='sell';
 INSERT INTO public.order_line_items(order_id,side,line_no,product_name,product_type,thickness,width,length,pieces,volume_m3,unit,unit_price_cents,line_total_cents,notes,catalog_product_id,catalog_variant_id,is_standard)
 VALUES(p_order_id,'sell',next_no,product.name,v.sku,CASE WHEN v.thickness_mm IS NULL THEN NULL ELSE v.thickness_mm::TEXT END,
   CASE WHEN v.width_mm IS NULL THEN NULL ELSE v.width_mm::TEXT END,CASE WHEN v.length_mm IS NULL THEN NULL ELSE v.length_mm::TEXT END,
   CASE WHEN p_unit IN ('m3','loose_m3') THEN NULL ELSE p_quantity::TEXT END,CASE WHEN p_unit IN ('m3','loose_m3') THEN p_quantity ELSE NULL END,
   p_unit,NULL,NULL,nullif(btrim(p_notes),''),product.id,v.id,true) RETURNING id INTO new_id;
 FOR assignment IN
   SELECT a.sort_order,a.is_required,f.field_key,f.field_label,f.unit,
     coalesce(vo.label,vv.value_text,vv.value_number::text,po.label,pv.value_text,pv.value_number::text,'0') value
   FROM public.catalog_category_field_assignments a
   JOIN public.catalog_fields f ON f.id=a.field_id AND f.field_type='number'
   LEFT JOIN public.catalog_product_field_values pv ON pv.product_id=product.id AND pv.field_id=f.id
   LEFT JOIN public.catalog_field_options po ON po.id=pv.option_id AND po.field_id=f.id AND po.is_active
   LEFT JOIN public.catalog_variant_field_values vv ON vv.variant_id=v.id AND vv.field_id=f.id
   LEFT JOIN public.catalog_field_options vo ON vo.id=vv.option_id AND vo.field_id=f.id AND vo.is_active
   WHERE a.category_id=category.id AND a.applies_to='process'
   ORDER BY a.sort_order,f.field_key,f.id
 LOOP
   resolved_value:=coalesce(nullif(btrim(assignment.value),''),'0');
   IF resolved_value !~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$' OR length(resolved_value)>500 THEN RAISE EXCEPTION 'INVALID_PROCESS_VALUE:%',assignment.field_key; END IF;
   INSERT INTO public.order_line_item_process_requirements(order_line_item_id,field_key,name,value,unit,sort_order,field_type,is_required)
   VALUES(new_id,assignment.field_key,assignment.field_label,resolved_value,assignment.unit,assignment.sort_order,'number',assignment.is_required);
 END LOOP;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_project_specification_line_with_processes(UUID,UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_project_specification_line_with_processes(UUID,UUID,NUMERIC,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_project_specification_line_with_snapshot(
  p_order_id UUID,p_catalog_variant_id UUID,p_quantity NUMERIC,p_unit TEXT,p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id UUID; product_id UUID; snapshot JSONB;
BEGIN
 new_id:=public.create_project_specification_line_with_processes(p_order_id,p_catalog_variant_id,p_quantity,p_unit,p_notes);
 SELECT catalog_product_id INTO product_id FROM public.order_line_items WHERE id=new_id;
 snapshot:=public.catalogue_basic_field_snapshot(product_id,p_catalog_variant_id);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot) field
   WHERE length(coalesce(field->>'key','')) NOT BETWEEN 1 AND 100
      OR length(coalesce(field->>'label','')) NOT BETWEEN 1 AND 200
      OR length(coalesce(field->>'unit',''))>50
      OR length(coalesce(field->>'value',''))>500
      OR jsonb_array_length(coalesce(field->'allowedOptions','[]'::jsonb))>500
      OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(field->'allowedOptions','[]'::jsonb)) option_label WHERE length(option_label)>500)
 ) THEN RAISE EXCEPTION 'BASIC_SNAPSHOT_TOO_LARGE'; END IF;
 UPDATE public.order_line_items SET specification_fields=snapshot WHERE id=new_id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_project_specification_line_with_snapshot(UUID,UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_project_specification_line_with_snapshot(UUID,UUID,NUMERIC,TEXT,TEXT) TO authenticated;

-- Capture only draft root catalogue rows that are actually missing their basic
-- snapshot. This prevents later catalogue changes from rewriting established
-- project snapshots.
CREATE TEMP TABLE _catalogue_snapshot_backfill_lines(id UUID PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _catalogue_snapshot_backfill_lines(id)
SELECT l.id FROM public.order_line_items l JOIN public.orders o ON o.id=l.order_id
WHERE l.catalog_product_id IS NOT NULL AND l.origin_line_item_id IS NULL
  AND l.specification_fields='[]'::jsonb AND o.lifecycle_stage='draft';

-- Repair only those broken roots. No existing structured value is rewritten.
UPDATE public.order_line_items l
SET specification_fields=public.catalogue_basic_field_snapshot(l.catalog_product_id,l.catalog_variant_id)
WHERE l.id IN (SELECT id FROM _catalogue_snapshot_backfill_lines);

INSERT INTO public.order_line_item_process_requirements(order_line_item_id,field_key,name,value,unit,sort_order,field_type,is_required)
SELECT l.id,f.field_key,f.field_label,
  CASE WHEN length(resolved.value)<=500 AND resolved.value ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$' THEN resolved.value ELSE '0' END,
  f.unit,a.sort_order,'number',a.is_required
FROM public.order_line_items l
JOIN _catalogue_snapshot_backfill_lines broken ON broken.id=l.id
JOIN public.catalog_products p ON p.id=l.catalog_product_id
JOIN public.catalog_category_field_assignments a ON a.category_id=p.category_id AND a.applies_to='process'
JOIN public.catalog_fields f ON f.id=a.field_id AND f.field_type='number'
LEFT JOIN public.catalog_product_field_values pv ON pv.product_id=p.id AND pv.field_id=f.id
LEFT JOIN public.catalog_field_options po ON po.id=pv.option_id AND po.field_id=f.id AND po.is_active
LEFT JOIN public.catalog_variant_field_values vv ON vv.variant_id=l.catalog_variant_id AND vv.field_id=f.id
LEFT JOIN public.catalog_field_options vo ON vo.id=vv.option_id AND vo.field_id=f.id AND vo.is_active
CROSS JOIN LATERAL (SELECT coalesce(nullif(btrim(coalesce(vo.label,vv.value_text,vv.value_number::text,po.label,pv.value_text,pv.value_number::text,'')),''),'0') value) resolved
ON CONFLICT(order_line_item_id,field_key) DO NOTHING;

-- Empty downstream copies inherit only from roots repaired above.
UPDATE public.order_line_items child
SET specification_fields=public.project_line_specification_fields(child.id)
WHERE child.origin_line_item_id IS NOT NULL AND child.specification_fields='[]'::jsonb
  AND public.resolve_project_process_root(child.id) IN (SELECT id FROM _catalogue_snapshot_backfill_lines);

CREATE OR REPLACE FUNCTION public.update_project_specification_structured_values(
  p_order_id UUID,p_line_id UUID,p_version TIMESTAMPTZ,p_basic_values JSONB,p_process_values JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.orders%ROWTYPE; l public.order_line_items%ROWTYPE; entry JSONB;
BEGIN
 IF p_basic_values IS NULL OR p_process_values IS NULL OR p_version IS NULL
   OR jsonb_typeof(p_basic_values)<>'array' OR jsonb_typeof(p_process_values)<>'array'
   OR jsonb_array_length(p_basic_values)>200 OR jsonb_array_length(p_process_values)>200 THEN RAISE EXCEPTION 'INVALID_VALUES'; END IF;
 SELECT * INTO d FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
 IF d.lifecycle_stage<>'draft' THEN RAISE EXCEPTION 'PROJECT_NOT_DRAFT'; END IF;
 IF d.deal_kind NOT IN ('buy_sell','sale_only') THEN RAISE EXCEPTION 'ROOT_PROJECT_REQUIRED'; END IF;
 IF NOT(public.is_current_user_platform_admin() OR (public.current_user_in_org(d.seller_organisation_id) AND public.current_user_deal_terms_access(d.seller_organisation_id,true))) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO l FROM public.order_line_items WHERE id=p_line_id AND order_id=p_order_id AND side='sell' FOR UPDATE;
 IF NOT FOUND OR l.catalog_product_id IS NULL OR l.origin_line_item_id IS NOT NULL THEN RAISE EXCEPTION 'LINE_NOT_EDITABLE'; END IF;
 IF l.updated_at<>p_version THEN RAISE EXCEPTION 'STALE_SPECIFICATION'; END IF;
 IF jsonb_array_length(p_basic_values)<>jsonb_array_length(l.specification_fields)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_basic_values) i WHERE jsonb_typeof(i)<>'object' OR length(coalesce(i->>'value',''))>500)
   OR EXISTS(SELECT key FROM (SELECT i->>'key' key,count(*) AS occurrences FROM jsonb_array_elements(p_basic_values) i GROUP BY i->>'key') x WHERE key IS NULL OR occurrences<>1)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(l.specification_fields) f WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_basic_values) i WHERE i->>'key'=f->>'key'))
 THEN RAISE EXCEPTION 'INVALID_BASIC_KEYS'; END IF;
 FOR entry IN SELECT i FROM jsonb_array_elements(p_basic_values) i LOOP
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(l.specification_fields) f WHERE f->>'key'=entry->>'key' AND f->>'type'='file')
      AND coalesce(entry->>'value','')<>(SELECT coalesce(f->>'value','') FROM jsonb_array_elements(l.specification_fields) f WHERE f->>'key'=entry->>'key') THEN RAISE EXCEPTION 'READ_ONLY_FILE_FIELD'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(l.specification_fields) f WHERE f->>'key'=entry->>'key' AND f->>'type'='select')
      AND coalesce(entry->>'value','')<>'' AND NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(l.specification_fields) f,
          jsonb_array_elements_text(coalesce(f->'allowedOptions','[]'::jsonb)) AS options(option_label)
        WHERE f->>'key'=entry->>'key' AND option_label=entry->>'value'
      ) THEN RAISE EXCEPTION 'INVALID_SELECT_VALUE'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(l.specification_fields) f WHERE f->>'key'=entry->>'key' AND f->>'type'='number')
      AND coalesce(entry->>'value','')<>'' AND entry->>'value' !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$' THEN RAISE EXCEPTION 'INVALID_BASIC_VALUE'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(l.specification_fields) f WHERE f->>'key'=entry->>'key' AND f->>'type'='boolean')
      AND coalesce(entry->>'value','') NOT IN ('','true','false') THEN RAISE EXCEPTION 'INVALID_BASIC_VALUE'; END IF;
 END LOOP;
 IF jsonb_array_length(p_process_values)<>(SELECT count(*) FROM public.order_line_item_process_requirements WHERE order_line_item_id=l.id)
   OR EXISTS(SELECT key FROM (SELECT i->>'key' key,count(*) AS occurrences FROM jsonb_array_elements(p_process_values) i GROUP BY i->>'key') x WHERE key IS NULL OR occurrences<>1)
   OR EXISTS(SELECT 1 FROM public.order_line_item_process_requirements r WHERE r.order_line_item_id=l.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_process_values) i WHERE i->>'key'=r.field_key))
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_process_values) i WHERE coalesce(i->>'value','') !~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$' OR length(i->>'value')>500)
 THEN RAISE EXCEPTION 'INVALID_PROCESS_VALUES'; END IF;
 UPDATE public.order_line_items target SET specification_fields=(
   SELECT jsonb_agg(f || jsonb_build_object('value',coalesce(i->>'value','')) ORDER BY ord)
   FROM jsonb_array_elements(target.specification_fields) WITH ORDINALITY source(f,ord)
   JOIN jsonb_array_elements(p_basic_values) i ON i->>'key'=f->>'key'
 ) WHERE target.id=l.id;
 UPDATE public.order_line_item_process_requirements r SET value=i.value
 FROM (SELECT value->>'key' key,value->>'value' value FROM jsonb_array_elements(p_process_values)) i
 WHERE r.order_line_item_id=l.id AND r.field_key=i.key;
END $$;
REVOKE ALL ON FUNCTION public.update_project_specification_structured_values(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_project_specification_structured_values(UUID,UUID,TIMESTAMPTZ,JSONB,JSONB) TO authenticated;

DROP FUNCTION IF EXISTS public.get_project_process_requirements(UUID[]);
CREATE FUNCTION public.get_project_process_requirements(p_line_ids UUID[])
RETURNS TABLE(request_line_id UUID,id UUID,field_key TEXT,name TEXT,value TEXT,unit TEXT,sort_order INTEGER,field_type TEXT,is_required BOOLEAN)
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
 SELECT roots.request_id,pr.id,pr.field_key,pr.name,pr.value,pr.unit,pr.sort_order,pr.field_type,pr.is_required
 FROM roots JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=roots.root_id
 ORDER BY roots.request_id,pr.sort_order,pr.field_key,pr.id;
END $$;
REVOKE ALL ON FUNCTION public.get_project_process_requirements(UUID[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_process_requirements(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
