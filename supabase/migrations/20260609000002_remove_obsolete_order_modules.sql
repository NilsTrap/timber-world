-- Remove the two now-obsolete Orders sub-modules from the registry.
--
--  * orders.create        — superseded: create/edit/cancel are now gated on
--    orders.view (anyone who can see the orders list can work with orders);
--    delete is admin-only in code. Nothing reads orders.create anymore.
--  * orders.customer-select — superseded by the company-role system: the order
--    Customer/Manufacturer/Producer parties are now driven by org roles +
--    trading partners, and the shipments org picker reads trading partners
--    directly. Nothing reads orders.customer-select anymore.
--
-- Delete child rows first (organization_modules / user_modules reference the
-- module_code), then the registry rows.

DELETE FROM public.user_modules
  WHERE module_code IN ('orders.create', 'orders.customer-select');

DELETE FROM public.organization_modules
  WHERE module_code IN ('orders.create', 'orders.customer-select');

DELETE FROM public.modules
  WHERE code IN ('orders.create', 'orders.customer-select');
