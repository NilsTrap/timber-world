-- Retire orders.tab.production.edit.
--
-- Production-field editing is now gated on orders.tab.production itself: anyone
-- who can SEE the Production tab may edit its fields (the updateOrder field
-- whitelist still restricts them to production fields only — no pricing /
-- customer). So the separate "edit" sub-module is redundant. The only holder
-- (Wood ART) also has orders.tab.production, so no one loses access.
--
-- Delete child rows first, then the registry row.

DELETE FROM public.user_modules
  WHERE module_code = 'orders.tab.production.edit';

DELETE FROM public.organization_modules
  WHERE module_code = 'orders.tab.production.edit';

DELETE FROM public.modules
  WHERE code = 'orders.tab.production.edit';
