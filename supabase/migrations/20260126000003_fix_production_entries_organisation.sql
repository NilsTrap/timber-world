-- =============================================
-- Fix Production Entries Organisation
-- Migration: 20260126000003_fix_production_entries_organisation.sql
-- Story: 6.3 - Context-Aware Inventory Queries
-- =============================================
-- The multi-tenancy migration (20260126000002) incorrectly set all
-- production entries' organisation_id to TWP. This fix updates them
-- to use the creator's organisation instead.

-- Fix production entries: set organisation_id from the creator's organisation
UPDATE portal_production_entries pe
SET organisation_id = pu.organisation_id
FROM portal_users pu
WHERE pe.created_by = pu.auth_user_id
  AND pu.organisation_id IS NOT NULL
  AND pe.organisation_id != pu.organisation_id;

-- Verify the fix (for logging)
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count
  FROM portal_production_entries pe
  JOIN portal_users pu ON pe.created_by = pu.auth_user_id
  WHERE pe.organisation_id = pu.organisation_id;

  RAISE NOTICE 'Production entries with correct organisation_id: %', fixed_count;
END $$;
