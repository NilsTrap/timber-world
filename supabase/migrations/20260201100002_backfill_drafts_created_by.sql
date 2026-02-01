-- Backfill created_by for draft entries that still have NULL

-- First try to set based on organisation - drafts from Inerts org get Maris
UPDATE portal_production_entries pe
SET created_by = pu.auth_user_id
FROM portal_users pu
JOIN organisations o ON pu.organisation_id = o.id
WHERE o.code = 'INE'
  AND pu.name = 'Maris'
  AND pe.organisation_id = o.id
  AND pe.created_by IS NULL
  AND pe.status = 'draft';

-- Any remaining drafts get admin
UPDATE portal_production_entries pe
SET created_by = pu.auth_user_id
FROM portal_users pu
WHERE pu.name = 'Nils Trapans'
  AND pe.created_by IS NULL
  AND pe.status = 'draft';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
