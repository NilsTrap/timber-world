-- Fix category casing for order tab modules to match the parent orders.view module
UPDATE features SET category = 'Orders' WHERE code IN (
  'orders.tab.list',
  'orders.tab.prices',
  'orders.tab.sales',
  'orders.tab.production',
  'orders.tab.analytics'
);
