-- =============================================
-- Epic 10: Platform Foundation v2 - Seed Default Roles
-- Migration: 20260201000004_epic10_seed_roles.sql
-- Story: 10.4 - Seed Default Roles
-- =============================================

-- =============================================
-- DEFAULT SYSTEM ROLES
-- These roles cannot be deleted (is_system = true)
-- =============================================

INSERT INTO roles (name, description, permissions, is_system, is_active) VALUES
  (
    'Full Access',
    'All features (for organization owner)',
    ARRAY['*'],
    true,
    true
  ),
  (
    'Org Admin',
    'Manages users within organization',
    ARRAY[
      'dashboard.view',
      'users.view', 'users.invite', 'users.edit', 'users.remove', 'users.credentials'
    ],
    true,
    true
  ),
  (
    'Production Manager',
    'Full production access',
    ARRAY[
      'dashboard.view',
      'inventory.view',
      'production.view', 'production.create', 'production.edit', 'production.validate', 'production.corrections',
      'shipments.view'
    ],
    true,
    true
  ),
  (
    'Inventory Manager',
    'Manages inventory and shipments',
    ARRAY[
      'dashboard.view',
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
      'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.delete', 'shipments.submit', 'shipments.accept', 'shipments.reject'
    ],
    true,
    true
  ),
  (
    'Viewer',
    'Read-only access',
    ARRAY[
      'dashboard.view',
      'inventory.view',
      'production.view',
      'shipments.view'
    ],
    true,
    true
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active;
