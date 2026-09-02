-- Active specification processes remain quoteable even when their quantity is zero.
-- Material line entries still require a positive quantity.
CREATE OR REPLACE FUNCTION public.normalize_project_quote_entries(p_order_id UUID,p_entries JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e JSONB;typ TEXT;target UUID;qty NUMERIC;canonical_qty NUMERIC;label TEXT;unit TEXT;price BIGINT;total NUMERIC:=0;normalized JSONB:='[]'::jsonb;seen TEXT[]:=ARRAY[]::TEXT[];
BEGIN
  IF p_entries IS NULL OR jsonb_typeof(p_entries)<>'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'INVALID_ENTRIES';END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    typ:=e->>'targetType';BEGIN target:=(e->>'targetId')::UUID;qty:=(e->>'quantity')::NUMERIC;price:=(e->>'unitPriceCents')::BIGINT;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INVALID_ENTRY';END;
    IF typ NOT IN('line','process') OR qty IS NULL OR qty<0 OR (typ='line' AND qty=0) OR price IS NULL OR price<0 OR price>2147483647 OR typ||':'||target::TEXT=ANY(seen) THEN RAISE EXCEPTION 'INVALID_ENTRY';END IF;
    seen:=array_append(seen,typ||':'||target::TEXT);canonical_qty:=NULL;
    IF typ='line' THEN
      SELECT public.project_origin_required_quantity(l.volume_m3,l.pieces),l.product_name,l.unit INTO canonical_qty,label,unit FROM public.order_line_items l WHERE l.id=target AND l.order_id=p_order_id AND l.side='sell';
    ELSE
      SELECT CASE WHEN pr.value~'^\s*[0-9]+([.][0-9]+)?\s*$' THEN trim(pr.value)::NUMERIC END,l.product_name||' · '||pr.name,coalesce(pr.unit,'unit') INTO canonical_qty,label,unit FROM public.order_line_items l JOIN public.order_line_item_process_requirements pr ON pr.order_line_item_id=public.resolve_project_process_root(l.id) WHERE pr.id=target AND pr.active=true AND l.order_id=p_order_id AND l.side='sell';
    END IF;
    IF canonical_qty IS NULL OR canonical_qty<0 OR (typ='line' AND canonical_qty=0) OR qty<>canonical_qty THEN RAISE EXCEPTION 'STALE_REQUIREMENT';END IF;
    total:=total+round(qty*price);IF total>9007199254740991 THEN RAISE EXCEPTION 'TOTAL_TOO_LARGE';END IF;
    normalized:=normalized||jsonb_build_array(jsonb_build_object('targetType',typ,'targetId',target,'label',label,'quantity',canonical_qty,'unit',unit,'unitPriceCents',price));
  END LOOP;
  RETURN jsonb_build_object('entries',normalized,'totalCents',total::BIGINT);
END $$;
REVOKE ALL ON FUNCTION public.normalize_project_quote_entries(UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_project_quote_entries(UUID,JSONB) TO service_role;

NOTIFY pgrst,'reload schema';
