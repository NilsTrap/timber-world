-- =============================================
-- Epic 10: Platform Foundation v2 - Seed Organization Types
-- Migration: 20260201000002_epic10_seed_org_types.sql
-- Story: 10.2 - Seed Organization Types
-- =============================================

-- =============================================
-- 1. INSERT ORGANIZATION TYPES
-- =============================================

INSERT INTO organization_types (name, description, icon, default_features, sort_order) VALUES
  (
    'principal',
    'Owns materials, orchestrates supply chain',
    'building-2',
    ARRAY[
      'dashboard.view',
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
      'production.view', 'production.create', 'production.edit', 'production.validate', 'production.delete', 'production.corrections',
      'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.delete', 'shipments.submit', 'shipments.accept', 'shipments.reject',
      'reference.view', 'reference.manage',
      'organizations.view', 'organizations.create', 'organizations.edit', 'organizations.delete',
      'users.view', 'users.invite', 'users.edit', 'users.remove', 'users.credentials',
      'analytics.view', 'analytics.export'
    ],
    1
  ),
  (
    'producer',
    'Manufactures products',
    'factory',
    ARRAY[
      'dashboard.view',
      'inventory.view',
      'production.view', 'production.create', 'production.edit', 'production.validate', 'production.corrections',
      'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.submit'
    ],
    2
  ),
  (
    'supplier',
    'Provides raw materials',
    'truck',
    ARRAY[
      'dashboard.view',
      'orders.view',
      'deliveries.view', 'deliveries.create', 'deliveries.edit',
      'invoices.view', 'invoices.create'
    ],
    3
  ),
  (
    'client',
    'Buys finished products',
    'shopping-cart',
    ARRAY[
      'dashboard.view',
      'orders.view', 'orders.create', 'orders.edit',
      'tracking.view',
      'invoices.view',
      'reorder.view', 'reorder.create'
    ],
    4
  ),
  (
    'trader',
    'Intermediary buyer/seller',
    'arrows-exchange',
    ARRAY[
      'dashboard.view',
      'orders.view', 'orders.create', 'orders.edit',
      'suppliers.view',
      'clients.view',
      'inventory.view'
    ],
    5
  ),
  (
    'logistics',
    'Transports goods',
    'package',
    ARRAY[
      'dashboard.view',
      'shipments.view',
      'tracking.view', 'tracking.update',
      'documents.view'
    ],
    6
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  default_features = EXCLUDED.default_features,
  sort_order = EXCLUDED.sort_order;

-- =============================================
-- 2. ASSIGN TYPES TO EXISTING ORGANIZATIONS
-- =============================================

-- TWP (Timber World Platform) is the principal
INSERT INTO organization_type_assignments (organization_id, type_id)
SELECT o.id, t.id
FROM organisations o
CROSS JOIN organization_types t
WHERE o.code = 'TWP' AND t.name = 'principal'
ON CONFLICT DO NOTHING;

-- All other organizations default to producer
INSERT INTO organization_type_assignments (organization_id, type_id)
SELECT o.id, t.id
FROM organisations o
CROSS JOIN organization_types t
WHERE o.code != 'TWP' AND t.name = 'producer'
  AND NOT EXISTS (
    SELECT 1 FROM organization_type_assignments ota
    WHERE ota.organization_id = o.id
  )
ON CONFLICT DO NOTHING;
