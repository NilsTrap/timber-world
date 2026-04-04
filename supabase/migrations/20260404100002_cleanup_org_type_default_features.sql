-- Cleanup: Remove ghost features and non-sidebar categories from org type defaults
-- Only keep the 10 modules that have actual sidebar pages

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
  'production.view', 'production.create', 'production.edit', 'production.validate', 'production.delete', 'production.corrections',
  'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.delete', 'shipments.submit', 'shipments.accept', 'shipments.reject',
  'reference.view', 'reference.manage',
  'organizations.view', 'organizations.create', 'organizations.edit', 'organizations.delete'
] WHERE name = 'principal';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'inventory.view',
  'production.view', 'production.create', 'production.edit', 'production.validate', 'production.corrections',
  'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.submit'
] WHERE name = 'producer';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'orders.view'
] WHERE name = 'supplier';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'orders.view', 'orders.create', 'orders.edit'
] WHERE name = 'client';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'orders.view', 'orders.create', 'orders.edit',
  'inventory.view'
] WHERE name = 'trader';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'shipments.view'
] WHERE name = 'logistics';

-- Also remove the ghost features from the features table (if any survived)
DELETE FROM features WHERE code IN (
  'tracking.view', 'tracking.update',
  'invoices.view', 'invoices.create',
  'reorder.view', 'reorder.create',
  'deliveries.view', 'deliveries.create', 'deliveries.edit',
  'suppliers.view',
  'clients.view',
  'documents.view',
  'analytics.view', 'analytics.export'
);

-- Remove non-sidebar feature categories (users, roles)
DELETE FROM features WHERE code IN (
  'users.view', 'users.invite', 'users.edit', 'users.remove', 'users.credentials',
  'roles.view', 'roles.manage'
);
