-- Migration: Replace roles/overrides system with direct user modules
-- The permission model simplifies to: org has module AND user has module
-- No more roles, user_roles, or user_permission_overrides tables.

-- 1. Create user_modules table (same pattern as organization_modules but per user per org)
CREATE TABLE IF NOT EXISTS user_modules (
  user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, module_code)
);

CREATE INDEX IF NOT EXISTS idx_user_modules_user ON user_modules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_modules_org ON user_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_modules_user_org ON user_modules(user_id, organization_id);

-- 2. Seed user_modules from existing data:
--    For every user membership, give them all the org's currently enabled modules.
--    This preserves current behavior (everyone in the org sees the same thing).
INSERT INTO user_modules (user_id, organization_id, module_code, enabled)
SELECT
  om_members.user_id,
  om_members.organization_id,
  om_members.module_code,
  true
FROM (
  -- Get all user-org pairs from organization_memberships joined with org modules
  SELECT DISTINCT
    m.user_id,
    m.organization_id,
    om.module_code
  FROM organization_memberships m
  JOIN organization_modules om ON om.organization_id = m.organization_id AND om.enabled = true
  WHERE m.is_active = true

  UNION

  -- Also handle legacy users who only have portal_users.organisation_id (no membership row)
  SELECT DISTINCT
    pu.id AS user_id,
    pu.organisation_id AS organization_id,
    om.module_code
  FROM portal_users pu
  JOIN organization_modules om ON om.organization_id = pu.organisation_id AND om.enabled = true
  WHERE pu.organisation_id IS NOT NULL
    AND pu.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM organization_memberships m2
      WHERE m2.user_id = pu.id AND m2.organization_id = pu.organisation_id
    )
) om_members
ON CONFLICT (user_id, organization_id, module_code) DO NOTHING;

-- 3. Drop the roles-related tables (cascade will clean up FK references)
DROP TABLE IF EXISTS user_permission_overrides CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- 4. Drop organization_types tables (no longer used)
DROP TABLE IF EXISTS organization_type_assignments CASCADE;
DROP TABLE IF EXISTS organization_types CASCADE;

-- 5. Rename the "features" table to "modules" for consistent terminology
-- (The table still exists as "features" - the earlier migration only renamed
--  organization_features → organization_modules but kept the features table)
ALTER TABLE features RENAME TO modules;

-- Update the FK reference name for clarity
-- organization_modules.module_code references features.code → now modules.code
-- (The constraint name may still reference "features", let's update it)
DO $$
BEGIN
  -- Rename constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_features_module_code_fkey'
    AND table_name = 'organization_modules'
  ) THEN
    ALTER TABLE organization_modules
      RENAME CONSTRAINT organization_features_module_code_fkey
      TO organization_modules_module_code_fkey;
  END IF;
END $$;
