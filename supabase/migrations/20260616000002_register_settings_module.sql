-- Register the new top-level **Settings** area as a grantable module so admins
-- can enable it per organisation (organization_modules) and per user
-- (user_modules):
--   settings.view → /admin/settings/**  (system settings: Fields, Packaging,
--                   Pricing Units — moved out of /admin/catalog in the
--                   Oscar-integration phase, E1.1)
--
-- Admins (super admins) bypass module checks. The field/packaging/pricing-unit
-- server actions accept settings.view OR catalogue.view, because the same
-- reference data is still read from catalog category/product/variant pages.

INSERT INTO public.modules (code, name, description, category, sort_order)
VALUES
  ('settings.view', 'View Settings', 'Manage system settings (fields, packaging, pricing units)', 'Settings', 1600)
ON CONFLICT (code) DO NOTHING;
