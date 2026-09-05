-- Specification authoring belongs to the seller-side trader persona. It must
-- not disappear because an organisation member lacks an unrelated deal-terms
-- access-group flag.
DO $$
DECLARE
  signature REGPROCEDURE;
  function_definition TEXT;
  updated_definition TEXT;
  old_guard CONSTANT TEXT := 'IF NOT(public.is_current_user_platform_admin() OR (public.current_user_in_org(d.seller_organisation_id) AND public.current_user_deal_terms_access(d.seller_organisation_id,true))) THEN';
  new_guard CONSTANT TEXT := 'IF NOT(public.is_current_user_platform_admin() OR (public.current_user_in_org(d.seller_organisation_id) AND EXISTS (SELECT 1 FROM public.organisations o WHERE o.id=d.seller_organisation_id AND o.is_active AND o.is_trader))) THEN';
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.create_project_specification_line_with_processes(uuid,uuid,numeric,text,text)'::REGPROCEDURE,
    'public.update_project_specification_structured_values(uuid,uuid,timestamptz,jsonb,jsonb)'::REGPROCEDURE,
    'public.update_project_specification_process_applicability(uuid,uuid,jsonb)'::REGPROCEDURE
  ] LOOP
    SELECT pg_get_functiondef(signature) INTO function_definition;
    updated_definition := replace(function_definition, old_guard, new_guard);
    IF updated_definition = function_definition THEN
      RAISE EXCEPTION 'EXPECTED_SPECIFICATION_PERMISSION_GUARD_NOT_FOUND: %', signature;
    END IF;
    EXECUTE updated_definition;
  END LOOP;
END $$;
