-- Staging enables safe-update protection. The roll-up table is transaction-local,
-- but its intentional all-row calculation still needs an explicit predicate.
DO $migration$
DECLARE
  definition TEXT;
  patched TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.save_project_commercial_rollup(uuid,text,jsonb,bigint,text,numeric)'::regprocedure
  ) INTO definition;
  patched := replace(
    definition,
    'END)/total_weight)::BIGINT;' || chr(10) || '  SELECT p_adjustment_cents',
    'END)/total_weight)::BIGINT WHERE true;' || chr(10) || '  SELECT p_adjustment_cents'
  );
  IF patched = definition THEN
    RAISE EXCEPTION 'save_project_commercial_rollup all-row update anchor missing';
  END IF;
  EXECUTE patched;
END
$migration$;
