-- Remove reference data as a standalone module
-- It's now accessed via the Users/Organisations page
DELETE FROM features WHERE code IN ('reference.view', 'reference.manage');

-- Remove reference.view from org type defaults (principal had it)
UPDATE organization_types SET default_features = ARRAY[
  'dashboard.view',
  'inventory.view',
  'production.view',
  'shipments.view',
  'organizations.view'
] WHERE name = 'principal';
