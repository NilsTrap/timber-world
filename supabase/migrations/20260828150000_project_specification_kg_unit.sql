-- Metal catalogue categories use kg as their primary specification unit.
-- Keep the atomic catalogue-import boundary aligned with the admin-managed unit registry.
CREATE OR REPLACE FUNCTION public.create_project_specification_line_with_processes(p_order_id UUID,p_catalog_variant_id UUID,p_quantity NUMERIC,p_unit TEXT,p_notes TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.orders%ROWTYPE; v public.catalog_variants%ROWTYPE; product public.catalog_products%ROWTYPE; category public.catalog_categories%ROWTYPE;
 new_id UUID; next_no INTEGER; resolved_value TEXT; assignment RECORD;
BEGIN
 IF p_unit NOT IN ('kg','m3','m2','piece','linear_m','package','crate','loose_m3') OR length(coalesce(p_notes,''))>2000 THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
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

REVOKE ALL ON FUNCTION public.create_project_specification_line_with_processes(UUID,UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_specification_line_with_processes(UUID,UUID,NUMERIC,TEXT,TEXT) TO authenticated;
