-- The configurable Specification lifecycle stage is still pre-RFQ and must
-- allow the same canonical specification edits as Draft.
DO $$
DECLARE
  signature REGPROCEDURE;
  function_definition TEXT;
  updated_definition TEXT;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.create_project_specification_line_with_processes(uuid,uuid,numeric,text,text)'::REGPROCEDURE,
    'public.update_project_specification_structured_values(uuid,uuid,timestamptz,jsonb,jsonb)'::REGPROCEDURE,
    'public.update_project_specification_process_applicability(uuid,uuid,jsonb)'::REGPROCEDURE
  ] LOOP
    SELECT pg_get_functiondef(signature) INTO function_definition;
    updated_definition := replace(
      function_definition,
      'IF d.lifecycle_stage<>''draft'' THEN',
      'IF d.lifecycle_stage NOT IN (''draft'',''specification'') THEN'
    );
    IF updated_definition = function_definition THEN
      RAISE EXCEPTION 'EXPECTED_SPECIFICATION_STAGE_GUARD_NOT_FOUND: %', signature;
    END IF;
    EXECUTE updated_definition;
  END LOOP;
END $$;
