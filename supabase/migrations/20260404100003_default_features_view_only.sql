-- Simplify default_features to only .view modules
-- Granular actions (create, edit, delete, etc.) will be added when permissions are implemented

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'inventory.view',
  'production.view',
  'shipments.view',
  'reference.view',
  'organizations.view'
] WHERE name = 'principal';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'inventory.view',
  'production.view',
  'shipments.view'
] WHERE name = 'producer';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'orders.view'
] WHERE name = 'supplier';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'orders.view'
] WHERE name = 'client';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'orders.view',
  'inventory.view'
] WHERE name = 'trader';

UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'shipments.view'
] WHERE name = 'logistics';
