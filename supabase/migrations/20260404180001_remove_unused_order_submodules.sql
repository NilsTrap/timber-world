-- Remove unused order sub-modules (pricing and production-status)
-- Keep: orders.view, orders.create, orders.customer-select

DELETE FROM organization_modules WHERE module_code IN ('orders.pricing', 'orders.production-status');
DELETE FROM features WHERE code IN ('orders.pricing', 'orders.production-status');
