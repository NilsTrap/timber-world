-- =============================================
-- Epic 10: Platform Foundation v2 - Migrate Users to Memberships
-- Migration: 20260201000005_epic10_migrate_users.sql
-- Story: 10.5 - Migrate Users to Memberships
-- =============================================

-- =============================================
-- 1. SET PLATFORM ADMIN FLAG FOR EXISTING SUPER ADMINS
-- Super Admins are users with admin role and no organisation_id
-- =============================================

UPDATE portal_users
SET is_platform_admin = true
WHERE role = 'admin'
  AND organisation_id IS NULL;

-- =============================================
-- 2. CREATE MEMBERSHIP RECORDS FOR EXISTING USERS
-- Each user with an organisation_id gets a membership record
-- =============================================

INSERT INTO organization_memberships (
  user_id,
  organization_id,
  is_active,
  is_primary,
  invited_at,
  invited_by,
  created_at
)
SELECT
  pu.id,
  pu.organisation_id,
  pu.is_active,
  true,  -- Their only org becomes primary
  pu.invited_at,
  pu.invited_by,
  pu.created_at
FROM portal_users pu
WHERE pu.organisation_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.user_id = pu.id AND om.organization_id = pu.organisation_id
  );

-- =============================================
-- 3. ASSIGN DEFAULT ROLES TO MIGRATED USERS
-- Based on their existing role column
-- =============================================

-- Users with 'admin' role in an org get 'Full Access' role
INSERT INTO user_roles (user_id, organization_id, role_id)
SELECT
  pu.id,
  pu.organisation_id,
  r.id
FROM portal_users pu
CROSS JOIN roles r
WHERE pu.organisation_id IS NOT NULL
  AND pu.role = 'admin'
  AND r.name = 'Full Access'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = pu.id AND ur.organization_id = pu.organisation_id
  );

-- Users with 'producer' role get 'Production Manager' role
INSERT INTO user_roles (user_id, organization_id, role_id)
SELECT
  pu.id,
  pu.organisation_id,
  r.id
FROM portal_users pu
CROSS JOIN roles r
WHERE pu.organisation_id IS NOT NULL
  AND pu.role = 'producer'
  AND r.name = 'Production Manager'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = pu.id AND ur.organization_id = pu.organisation_id
  );

-- =============================================
-- 4. INITIALIZE ORGANIZATION FEATURES
-- Copy default features from org types to organization_features
-- =============================================

INSERT INTO organization_features (organization_id, feature_code, enabled)
SELECT DISTINCT
  ota.organization_id,
  unnest(ot.default_features),
  true
FROM organization_type_assignments ota
JOIN organization_types ot ON ot.id = ota.type_id
ON CONFLICT (organization_id, feature_code) DO NOTHING;

-- =============================================
-- NOTE: organisation_id column on portal_users is KEPT
-- for backward compatibility during transition.
-- New code should use organization_memberships table.
-- =============================================
