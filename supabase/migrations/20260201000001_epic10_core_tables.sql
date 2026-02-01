-- =============================================
-- Epic 10: Platform Foundation v2 - Core Tables
-- Migration: 20260201000001_epic10_core_tables.sql
-- Story: 10.1 - Database Schema - Core Tables
-- =============================================
-- Creates 9 new tables for multi-org membership, roles, permissions, and features

-- =============================================
-- 1. ORGANIZATION_TYPES TABLE
-- Types as tags (principal, producer, supplier, client, trader, logistics)
-- =============================================

CREATE TABLE organization_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  default_features TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organization_types_name ON organization_types(name);
CREATE INDEX idx_organization_types_sort ON organization_types(sort_order);

COMMENT ON TABLE organization_types IS 'Organization types as tags (can have multiple per org)';
COMMENT ON COLUMN organization_types.default_features IS 'Feature codes enabled by default for this type';

-- =============================================
-- 2. ORGANIZATION_TYPE_ASSIGNMENTS TABLE
-- Junction table for org-type many-to-many
-- =============================================

CREATE TABLE organization_type_assignments (
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES organization_types(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (organization_id, type_id)
);

CREATE INDEX idx_org_type_assignments_org ON organization_type_assignments(organization_id);
CREATE INDEX idx_org_type_assignments_type ON organization_type_assignments(type_id);

COMMENT ON TABLE organization_type_assignments IS 'Links organizations to their types (many-to-many)';

-- =============================================
-- 3. ORGANIZATION_RELATIONSHIPS TABLE
-- Business relationships between organizations
-- =============================================

CREATE TABLE organization_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_a_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  party_b_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT org_relationships_different_parties CHECK (party_a_id != party_b_id)
);

CREATE INDEX idx_org_relationships_party_a ON organization_relationships(party_a_id);
CREATE INDEX idx_org_relationships_party_b ON organization_relationships(party_b_id);
CREATE INDEX idx_org_relationships_type ON organization_relationships(relationship_type);
CREATE INDEX idx_org_relationships_active ON organization_relationships(is_active);

COMMENT ON TABLE organization_relationships IS 'Business relationships between organizations (supplier/client, etc.)';
COMMENT ON COLUMN organization_relationships.party_a_id IS 'First party (typically seller/supplier role)';
COMMENT ON COLUMN organization_relationships.party_b_id IS 'Second party (typically buyer/client role)';

-- =============================================
-- 4. ORGANIZATION_MEMBERSHIPS TABLE
-- Users can belong to multiple organizations
-- =============================================

CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT org_memberships_unique UNIQUE (user_id, organization_id)
);

CREATE INDEX idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX idx_org_memberships_org ON organization_memberships(organization_id);
CREATE INDEX idx_org_memberships_active ON organization_memberships(is_active);
CREATE INDEX idx_org_memberships_primary ON organization_memberships(is_primary);

COMMENT ON TABLE organization_memberships IS 'User membership in organizations (supports multi-org)';
COMMENT ON COLUMN organization_memberships.is_primary IS 'Primary org for this user (default context on login)';

-- =============================================
-- 5. FEATURES TABLE
-- Registry of all platform features
-- =============================================

CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_features_code ON features(code);
CREATE INDEX idx_features_category ON features(category);
CREATE INDEX idx_features_sort ON features(sort_order);

COMMENT ON TABLE features IS 'Registry of all platform features for permission control';
COMMENT ON COLUMN features.code IS 'Unique feature code (e.g., production.create, inventory.view)';

-- =============================================
-- 6. ORGANIZATION_FEATURES TABLE
-- Feature enablement per organization
-- =============================================

CREATE TABLE organization_features (
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (organization_id, feature_code)
);

CREATE INDEX idx_org_features_org ON organization_features(organization_id);
CREATE INDEX idx_org_features_code ON organization_features(feature_code);
CREATE INDEX idx_org_features_enabled ON organization_features(enabled);

COMMENT ON TABLE organization_features IS 'Feature enablement per organization (layer 1 of permissions)';

-- =============================================
-- 7. ROLES TABLE
-- Permission bundles
-- =============================================

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_is_system ON roles(is_system);
CREATE INDEX idx_roles_is_active ON roles(is_active);

COMMENT ON TABLE roles IS 'Role definitions with permission bundles (layer 2 of permissions)';
COMMENT ON COLUMN roles.permissions IS 'Array of feature codes this role grants';
COMMENT ON COLUMN roles.is_system IS 'System roles cannot be deleted';

-- =============================================
-- 8. USER_ROLES TABLE
-- Role assignments per user per organization
-- =============================================

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_org ON user_roles(organization_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_user_org ON user_roles(user_id, organization_id);

COMMENT ON TABLE user_roles IS 'Role assignments for users within organizations';

-- =============================================
-- 9. USER_PERMISSION_OVERRIDES TABLE
-- Per-user feature grants/denies
-- =============================================

CREATE TABLE user_permission_overrides (
  user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, feature_code)
);

CREATE INDEX idx_user_perm_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX idx_user_perm_overrides_org ON user_permission_overrides(organization_id);
CREATE INDEX idx_user_perm_overrides_user_org ON user_permission_overrides(user_id, organization_id);

COMMENT ON TABLE user_permission_overrides IS 'Per-user permission overrides (layer 3 of permissions)';
COMMENT ON COLUMN user_permission_overrides.granted IS 'true = add permission, false = remove permission';

-- =============================================
-- 10. ADD is_platform_admin TO portal_users
-- =============================================

ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_portal_users_platform_admin
  ON portal_users(is_platform_admin);

COMMENT ON COLUMN portal_users.is_platform_admin IS 'Platform admin has access to all organizations and admin features';

-- =============================================
-- 11. AUDIT_LOG TABLE (for impersonation tracking)
-- =============================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actual_user_id UUID REFERENCES portal_users(id),
  target_org_id UUID REFERENCES organisations(id),
  target_user_id UUID REFERENCES portal_users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_log_actual_user ON audit_log(actual_user_id);
CREATE INDEX idx_audit_log_target_org ON audit_log(target_org_id);
CREATE INDEX idx_audit_log_target_user ON audit_log(target_user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

COMMENT ON TABLE audit_log IS 'Audit trail for sensitive actions including impersonation';
