-- A platform admin may enter a supplier quotation on the supplier's behalf.
-- Permit an admin correction to clear the final entry when the corresponding
-- specification requirement becomes inactive. Supplier submission remains
-- unchanged and still requires at least one priced entry.
CREATE OR REPLACE FUNCTION public.correct_project_rfq_quote_entries(
  p_candidate_id UUID,p_entries JSONB,p_notes TEXT DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_rfq_candidates%ROWTYPE; r public.project_rfqs%ROWTYPE;
  e JSONB; typ TEXT; target UUID; qty NUMERIC; canonical_qty NUMERIC; label TEXT; unit TEXT;
  price BIGINT; total NUMERIC:=0; normalized JSONB:='[]'::jsonb; seen TEXT[]:=ARRAY[]::TEXT[];
BEGIN
  IF NOT public.is_current_user_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_entries IS NULL OR jsonb_typeof(p_entries)<>'array' OR jsonb_array_length(p_entries) NOT BETWEEN 0 AND 500 THEN RAISE EXCEPTION 'INVALID_ENTRIES'; END IF;
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
      commercial_stale_at=CASE WHEN commercial_confirmed_at IS NULL AND resale_value_cents IS NULL THEN NULL ELSE now() END,updated_at=now()
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
