-- Structured RFQ pricing. Specification requirements remain price-free.
ALTER TABLE public.order_line_items ADD COLUMN IF NOT EXISTS specification_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.order_line_items DROP CONSTRAINT IF EXISTS order_line_items_specification_fields_check;
ALTER TABLE public.order_line_items ADD CONSTRAINT order_line_items_specification_fields_check
  CHECK (jsonb_typeof(specification_fields)='array' AND jsonb_array_length(specification_fields)<=200);

-- One-time prototype backfill for catalogue-linked lines created before structured snapshots existed.
UPDATE public.order_line_items l SET specification_fields=coalesce((
  SELECT jsonb_agg(jsonb_build_object('key',resolved.field_key,'label',resolved.field_label,'value',resolved.display_value) ORDER BY resolved.field_key)
  FROM (
    SELECT DISTINCT ON (f.id) f.id,f.field_key,f.field_label,
      coalesce(o.label,v.value_text,CASE WHEN v.value_number IS NULL THEN NULL ELSE v.value_number::TEXT||CASE WHEN f.unit IS NULL THEN '' ELSE ' '||f.unit END END) display_value
    FROM (
      SELECT pfv.field_id,pfv.option_id,pfv.value_text,pfv.value_number,0 priority FROM public.catalog_product_field_values pfv WHERE pfv.product_id=l.catalog_product_id
      UNION ALL SELECT vfv.field_id,vfv.option_id,vfv.value_text,vfv.value_number,1 FROM public.catalog_variant_field_values vfv WHERE vfv.variant_id=l.catalog_variant_id
    ) v JOIN public.catalog_fields f ON f.id=v.field_id
    LEFT JOIN public.catalog_field_options o ON o.id=v.option_id
    LEFT JOIN public.catalog_products p ON p.id=l.catalog_product_id
    LEFT JOIN public.catalog_category_field_assignments a ON a.category_id=p.category_id AND a.field_id=f.id
    WHERE coalesce(a.applies_to,'product')<>'process'
    ORDER BY f.id,v.priority DESC
  ) resolved WHERE nullif(btrim(resolved.display_value),'') IS NOT NULL
),'[]'::jsonb)
WHERE l.catalog_product_id IS NOT NULL AND l.specification_fields='[]'::jsonb;

-- Create the catalogue line, process requirements, and immutable basic-field snapshot in one transaction.
CREATE OR REPLACE FUNCTION public.create_project_specification_line_with_snapshot(
  p_order_id UUID,p_catalog_variant_id UUID,p_quantity NUMERIC,p_unit TEXT,p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id UUID; snapshot JSONB;
BEGIN
  new_id := public.create_project_specification_line_with_processes(p_order_id,p_catalog_variant_id,p_quantity,p_unit,p_notes);
  SELECT coalesce(jsonb_agg(jsonb_build_object('key',resolved.field_key,'label',resolved.field_label,'value',resolved.display_value) ORDER BY resolved.field_key),'[]'::jsonb)
  INTO snapshot FROM (
    SELECT DISTINCT ON (f.id) f.id,f.field_key,f.field_label,
      coalesce(o.label,v.value_text,CASE WHEN v.value_number IS NULL THEN NULL ELSE v.value_number::TEXT||CASE WHEN f.unit IS NULL THEN '' ELSE ' '||f.unit END END) display_value
    FROM public.order_line_items l
    JOIN public.catalog_products p ON p.id=l.catalog_product_id
    JOIN (
      SELECT pfv.field_id,pfv.option_id,pfv.value_text,pfv.value_number,0 priority FROM public.catalog_product_field_values pfv
      JOIN public.catalog_variants cv ON cv.product_id=pfv.product_id WHERE cv.id=p_catalog_variant_id
      UNION ALL SELECT vfv.field_id,vfv.option_id,vfv.value_text,vfv.value_number,1 FROM public.catalog_variant_field_values vfv WHERE vfv.variant_id=p_catalog_variant_id
    ) v ON true
    JOIN public.catalog_fields f ON f.id=v.field_id
    LEFT JOIN public.catalog_field_options o ON o.id=v.option_id
    LEFT JOIN public.catalog_category_field_assignments a ON a.category_id=p.category_id AND a.field_id=f.id
    WHERE l.id=new_id AND coalesce(a.applies_to,'product')<>'process'
    ORDER BY f.id,v.priority DESC
  ) resolved WHERE nullif(btrim(resolved.display_value),'') IS NOT NULL;
  UPDATE public.order_line_items SET specification_fields=snapshot WHERE id=new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_project_specification_line_with_snapshot(UUID,UUID,NUMERIC,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_project_specification_line_with_snapshot(UUID,UUID,NUMERIC,TEXT,TEXT) TO authenticated;

-- Work-package legs inherit the canonical root snapshot rather than a mutable catalogue record.
CREATE OR REPLACE FUNCTION public.project_line_specification_fields(p_line_id UUID)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH RECURSIVE ancestry AS (
    SELECT id,origin_line_item_id,specification_fields,0 depth FROM public.order_line_items WHERE id=p_line_id
    UNION ALL
    SELECT parent.id,parent.origin_line_item_id,parent.specification_fields,child.depth+1
    FROM public.order_line_items parent JOIN ancestry child ON parent.id=child.origin_line_item_id WHERE child.depth<20
  ) SELECT coalesce((SELECT specification_fields FROM ancestry ORDER BY depth DESC LIMIT 1),'[]'::jsonb)
$$;
REVOKE ALL ON FUNCTION public.project_line_specification_fields(UUID) FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION public.inherit_project_line_specification_fields() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.origin_line_item_id IS NOT NULL THEN NEW.specification_fields:=public.project_line_specification_fields(NEW.origin_line_item_id); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS inherit_project_line_specification_fields ON public.order_line_items;
CREATE TRIGGER inherit_project_line_specification_fields BEFORE INSERT OR UPDATE OF origin_line_item_id
ON public.order_line_items FOR EACH ROW EXECUTE FUNCTION public.inherit_project_line_specification_fields();
UPDATE public.order_line_items SET specification_fields=public.project_line_specification_fields(id)
WHERE origin_line_item_id IS NOT NULL AND specification_fields='[]'::jsonb;

INSERT INTO public.order_line_item_process_requirements(order_line_item_id,field_key,name,value,unit,sort_order)
SELECT l.id,f.field_key,f.field_label,
  coalesce(o.label,pfv.value_text,CASE WHEN pfv.value_number IS NULL THEN NULL ELSE pfv.value_number::TEXT END),f.unit,a.sort_order
FROM public.order_line_items l JOIN public.catalog_products p ON p.id=l.catalog_product_id
JOIN public.catalog_category_field_assignments a ON a.category_id=p.category_id AND a.applies_to='process'
JOIN public.catalog_fields f ON f.id=a.field_id
JOIN public.catalog_product_field_values pfv ON pfv.product_id=p.id AND pfv.field_id=f.id
LEFT JOIN public.catalog_field_options o ON o.id=pfv.option_id
WHERE nullif(btrim(coalesce(o.label,pfv.value_text,CASE WHEN pfv.value_number IS NULL THEN NULL ELSE pfv.value_number::TEXT END)),'') IS NOT NULL
ON CONFLICT(order_line_item_id,field_key) DO NOTHING;

ALTER TABLE public.project_rfq_candidates
  ADD COLUMN IF NOT EXISTS quote_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quote_entered_by UUID REFERENCES public.portal_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quote_entered_as_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.project_rfq_candidates DROP CONSTRAINT IF EXISTS project_rfq_candidates_quote_entries_check;
ALTER TABLE public.project_rfq_candidates ADD CONSTRAINT project_rfq_candidates_quote_entries_check
  CHECK (jsonb_typeof(quote_entries) = 'array' AND jsonb_array_length(quote_entries) <= 500);

CREATE OR REPLACE FUNCTION public.submit_project_rfq_quote_entries(
  p_candidate_id UUID,
  p_entries JSONB,
  p_notes TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.project_rfq_candidates%ROWTYPE;
  r public.project_rfqs%ROWTYPE;
  entry JSONB;
  entry_type TEXT;
  target_id UUID;
  quantity NUMERIC;
  canonical_quantity NUMERIC;
  canonical_label TEXT;
  canonical_unit TEXT;
  unit_price BIGINT;
  total NUMERIC := 0;
  normalized_entries JSONB := '[]'::jsonb;
  seen_targets TEXT[] := ARRAY[]::TEXT[];
  is_admin BOOLEAN := public.is_current_user_platform_admin();
BEGIN
  IF jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) < 1 OR jsonb_array_length(p_entries) > 500 THEN RAISE EXCEPTION 'INVALID_ENTRIES'; END IF;
  IF length(coalesce(p_notes,'')) > 4000 THEN RAISE EXCEPTION 'INVALID_NOTES'; END IF;
  SELECT * INTO c FROM public.project_rfq_candidates WHERE id = p_candidate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CANDIDATE_NOT_FOUND'; END IF;
  SELECT * INTO r FROM public.project_rfqs WHERE id = c.rfq_id FOR UPDATE;
  IF r.status <> 'open' OR r.deadline <= now() THEN RAISE EXCEPTION 'RFQ_CLOSED'; END IF;
  IF NOT (is_admin OR public.current_user_in_org(c.organization_id)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    canonical_quantity := NULL; canonical_label := NULL; canonical_unit := NULL;
    entry_type := entry->>'targetType';
    BEGIN target_id := (entry->>'targetId')::UUID; quantity := (entry->>'quantity')::NUMERIC; unit_price := (entry->>'unitPriceCents')::BIGINT;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INVALID_ENTRY'; END;
    IF entry_type NOT IN ('line','process') OR quantity <= 0 OR unit_price < 0 OR length(coalesce(entry->>'label','')) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'INVALID_ENTRY'; END IF;
    IF entry_type||':'||target_id::TEXT = ANY(seen_targets) THEN RAISE EXCEPTION 'DUPLICATE_ENTRY'; END IF;
    seen_targets := array_append(seen_targets,entry_type||':'||target_id::TEXT);
    IF entry_type = 'line' THEN
      SELECT public.project_origin_required_quantity(l.volume_m3,l.pieces),l.product_name,l.unit
      INTO canonical_quantity,canonical_label,canonical_unit
      FROM public.order_line_items l WHERE l.id=target_id AND l.order_id=r.order_id AND l.side='sell';
    ELSE
      SELECT CASE WHEN pr.value ~ '^\s*[0-9]+([.][0-9]+)?\s*$' THEN trim(pr.value)::NUMERIC END,
        l.product_name||' · '||pr.name,coalesce(pr.unit,'unit')
      INTO canonical_quantity,canonical_label,canonical_unit
      FROM public.order_line_items l JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=public.resolve_project_process_root(l.id)
      WHERE pr.id=target_id AND l.order_id=r.order_id AND l.side='sell';
    END IF;
    IF canonical_quantity IS NULL OR canonical_quantity <= 0 OR quantity <> canonical_quantity THEN RAISE EXCEPTION 'STALE_REQUIREMENT'; END IF;
    total := total + round(canonical_quantity * unit_price);
    IF total > 9223372036854775807 THEN RAISE EXCEPTION 'TOTAL_TOO_LARGE'; END IF;
    normalized_entries := normalized_entries || jsonb_build_array(jsonb_build_object(
      'targetType',entry_type,'targetId',target_id,'label',canonical_label,
      'quantity',canonical_quantity,'unit',canonical_unit,'unitPriceCents',unit_price));
  END LOOP;

  UPDATE public.project_rfq_candidates SET quote_entries=normalized_entries,quote_total_cents=total::BIGINT,
    quote_notes=nullif(trim(p_notes),''),status='submitted',submitted_at=now(),
    quote_entered_by=public.current_portal_user_id(),quote_entered_as_admin=is_admin
  WHERE id=p_candidate_id;
  RETURN total::BIGINT;
END $$;

REVOKE ALL ON FUNCTION public.submit_project_rfq_quote_entries(UUID,JSONB,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_project_rfq_quote_entries(UUID,JSONB,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_project_rfq_candidate_snapshot(p_order_id UUID) RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('id',o.id,'reference',coalesce(o.deal_code,o.code),'name',o.name,'stage',o.lifecycle_stage,'deliveryDeadline',o.delivery_deadline,'currency',o.currency,
 'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'lineNo',l.line_no,'productName',l.product_name,'woodSpecies',l.wood_species,'humidity',l.humidity,'processing',l.processing,
 'quality',l.quality,'thickness',l.thickness,'width',l.width,'length',l.length,'pieces',l.pieces,'volumeM3',l.volume_m3,'unit',l.unit,'notes',l.notes,'basicProperties',public.project_line_specification_fields(l.id),
 'processRequirements',coalesce((WITH root AS (SELECT public.resolve_project_process_root(l.id) id)
   SELECT jsonb_agg(jsonb_build_object('id',pr.id,'fieldKey',pr.field_key,'name',pr.name,'value',pr.value,'unit',pr.unit) ORDER BY pr.sort_order,pr.field_key,pr.id)
   FROM root JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=root.id),'[]'::jsonb))
 ORDER BY l.line_no,l.id) FROM public.order_line_items l WHERE l.order_id=o.id AND l.side='sell'),'[]'::jsonb))
 FROM public.orders o WHERE o.id=p_order_id AND EXISTS(SELECT 1 FROM public.project_rfqs r JOIN public.project_rfq_candidates c ON c.rfq_id=r.id
 WHERE r.order_id=o.id AND r.status='open' AND r.deadline>now() AND public.current_user_in_org(c.organization_id))
$$;
REVOKE ALL ON FUNCTION public.get_project_rfq_candidate_snapshot(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_rfq_candidate_snapshot(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
