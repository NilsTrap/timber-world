-- Project stages are configurable presentation/workflow labels. RFQ creation
-- and award are governed by RFQ, party, permission, and allocation state and
-- must not become invalid merely because an admin changes the project stage.

DO $$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.create_project_rfq(uuid,uuid[],timestamp with time zone)'::regprocedure) INTO v_def;
  v_new := replace(v_def, 'v_order.lifecycle_stage<>''draft'' OR ', '');
  IF v_new = v_def THEN
    v_new := replace(v_def, 'v_order.lifecycle_stage <> ''draft'' OR ', '');
  END IF;
  IF v_new = v_def THEN RAISE EXCEPTION 'create_project_rfq stage anchor missing'; END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.award_project_rfq(uuid,uuid)'::regprocedure) INTO v_def;
  v_new := replace(
    v_def,
    'IF NOT FOUND OR o.lifecycle_stage<>''draft'' THEN RAISE EXCEPTION ''LEG_NOT_DRAFT''; END IF;',
    'IF NOT FOUND THEN RAISE EXCEPTION ''LEG_NOT_FOUND''; END IF;'
  );
  IF v_new = v_def THEN
    v_new := replace(
      v_def,
      'IF NOT FOUND OR o.lifecycle_stage <> ''draft'' THEN RAISE EXCEPTION ''LEG_NOT_DRAFT''; END IF;',
      'IF NOT FOUND THEN RAISE EXCEPTION ''LEG_NOT_FOUND''; END IF;'
    );
  END IF;
  IF v_new = v_def THEN RAISE EXCEPTION 'award_project_rfq stage anchor missing'; END IF;
  EXECUTE v_new;
END;
$$;
