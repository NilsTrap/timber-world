-- Backfill created_by for existing production entries

-- Set Maris (Inerts user) as creator for Jan 30 entries
UPDATE portal_production_entries pe
SET created_by = pu.auth_user_id
FROM portal_users pu
WHERE pu.name = 'Maris'
  AND pe.created_by IS NULL
  AND pe.production_date = '2026-01-30';

-- Set admin as creator for all remaining entries without a creator
UPDATE portal_production_entries pe
SET created_by = pu.auth_user_id
FROM portal_users pu
WHERE pu.name = 'Nils Trapans'
  AND pe.created_by IS NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
