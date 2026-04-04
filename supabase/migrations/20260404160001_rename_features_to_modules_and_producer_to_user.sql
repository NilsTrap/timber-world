-- =============================================
-- Rename features→modules and fix producer→user in DB schema
-- Migration: 20260404160001_rename_features_to_modules_and_producer_to_user.sql
-- =============================================

-- 1. Rename organization_features → organization_modules
ALTER TABLE organization_features RENAME TO organization_modules;
ALTER TABLE organization_modules RENAME COLUMN feature_code TO module_code;

-- Update indexes (drop old, create new)
DROP INDEX IF EXISTS idx_org_features_org;
DROP INDEX IF EXISTS idx_org_features_code;
DROP INDEX IF EXISTS idx_org_features_enabled;
CREATE INDEX idx_org_modules_org ON organization_modules(organization_id);
CREATE INDEX idx_org_modules_code ON organization_modules(module_code);
CREATE INDEX idx_org_modules_enabled ON organization_modules(enabled);

COMMENT ON TABLE organization_modules IS 'Module enablement per organization (layer 1 of permissions)';

-- 2. Rename user_permission_overrides columns (feature_code → module_code)
ALTER TABLE user_permission_overrides RENAME COLUMN feature_code TO module_code;

-- Update indexes
DROP INDEX IF EXISTS idx_user_perm_overrides_user;
DROP INDEX IF EXISTS idx_user_perm_overrides_org;
DROP INDEX IF EXISTS idx_user_perm_overrides_user_org;
CREATE INDEX idx_user_module_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX idx_user_module_overrides_org ON user_permission_overrides(organization_id);
CREATE INDEX idx_user_module_overrides_user_org ON user_permission_overrides(user_id, organization_id);

-- 3. Fix portal_users role constraint: allow 'user' instead of 'producer'
-- The role values were already migrated by 20260404100005, but the CHECK constraint still allows 'producer'
ALTER TABLE portal_users DROP CONSTRAINT IF EXISTS portal_users_role_check;
ALTER TABLE portal_users ADD CONSTRAINT portal_users_role_check CHECK (role IN ('admin', 'user'));
ALTER TABLE portal_users ALTER COLUMN role SET DEFAULT 'user';

-- 4. Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
