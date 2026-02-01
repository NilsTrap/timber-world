-- Debug: Check draft entries and set created_by if missing
-- This migration will set all remaining NULL created_by to admin

-- Get admin auth_user_id and update any remaining NULL entries (both draft and validated)
UPDATE portal_production_entries pe
SET created_by = (
  SELECT auth_user_id 
  FROM portal_users 
  WHERE name = 'Nils Trapans' 
  AND auth_user_id IS NOT NULL 
  LIMIT 1
)
WHERE pe.created_by IS NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
