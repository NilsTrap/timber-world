-- The roll-up function intentionally uses `source` as both its JSON variable and
-- a set-returning-function alias. Recompile it with SQL columns taking precedence.
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
    E'\nDECLARE target',
    E'\n#variable_conflict use_column\nDECLARE target'
  );
  IF patched = definition THEN
    RAISE EXCEPTION 'save_project_commercial_rollup declaration anchor missing';
  END IF;
  EXECUTE patched;
END
$migration$;
