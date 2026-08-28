-- Keep project lifecycle presentation aligned with authoritative RFQ events.
-- These updates run inside the existing RFQ transactions, so a failed workflow
-- operation cannot leave the stage ahead of the underlying commercial state.

DO $$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.create_project_rfq(uuid,uuid[],timestamp with time zone)'::regprocedure) INTO v_def;
  v_new := replace(
    v_def,
    'RETURN v_rfq;',
    'UPDATE public.orders SET lifecycle_stage=''request_for_quotation'' WHERE id=v_order.id;
  RETURN v_rfq;'
  );
  IF v_new = v_def THEN RAISE EXCEPTION 'create_project_rfq return anchor missing'; END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.award_project_rfq(uuid,uuid)'::regprocedure) INTO v_def;
  v_new := replace(
    v_def,
    'value_cents=c.quote_total_cents WHERE id=o.id;',
    'value_cents=c.quote_total_cents,lifecycle_stage=''awarded'' WHERE id=o.id;'
  );
  IF v_new = v_def THEN
    v_new := replace(
      v_def,
      'value_cents = c.quote_total_cents WHERE id = o.id;',
      'value_cents = c.quote_total_cents, lifecycle_stage = ''awarded'' WHERE id = o.id;'
    );
  END IF;
  IF v_new = v_def THEN RAISE EXCEPTION 'award_project_rfq update anchor missing'; END IF;
  EXECUTE v_new;
END;
$$;
