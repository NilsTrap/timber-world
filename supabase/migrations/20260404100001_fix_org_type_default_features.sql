-- Fix: Repopulate default_features on organization_types
-- These were seeded in 20260201000002 but appear to have been cleared

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
  'production.view', 'production.create', 'production.edit', 'production.validate', 'production.delete', 'production.corrections',
  'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.delete', 'shipments.submit', 'shipments.accept', 'shipments.reject',
  'reference.view', 'reference.manage',
  'organizations.view', 'organizations.create', 'organizations.edit', 'organizations.delete',
  'users.view', 'users.invite', 'users.edit', 'users.remove', 'users.credentials',
  'analytics.view', 'analytics.export'
] WHERE name = 'principal';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'inventory.view',
  'production.view', 'production.create', 'production.edit', 'production.validate', 'production.corrections',
  'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.submit'
] WHERE name = 'producer';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'orders.view',
  'deliveries.view', 'deliveries.create', 'deliveries.edit',
  'invoices.view', 'invoices.create'
] WHERE name = 'supplier';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'orders.view', 'orders.create', 'orders.edit',
  'tracking.view',
  'invoices.view',
  'reorder.view', 'reorder.create'
] WHERE name = 'client';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'orders.view', 'orders.create', 'orders.edit',
  'suppliers.view',
  'clients.view',
  'inventory.view'
] WHERE name = 'trader';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'shipments.view',
  'tracking.view', 'tracking.update',
  'documents.view'
] WHERE name = 'logistics';
