-- Register the new top-level **Settings** area as a grantable module so admins
-- can enable it per organisation (organization_modules) and per user
-- (user_modules):
--   settings.view → /admin/settings/**  (system settings: Fields, Packaging,
--                   Pricing Units — moved out of /admin/catalog in the
--                   Oscar-integration phase, E1.1)
--
-- Admins (super admins) bypass module checks. To avoid stranding existing
-- catalogue.view org users (who reached Fields/Packaging/Pricing Units via the
-- old Catalogue sub-nav), the Settings nav item, the /admin/settings/* page
-- guards AND the field/packaging/pricing-unit server actions all accept
-- settings.view OR catalogue.view. settings.view exists to grant the Settings
-- area to non-catalogue users without also opening the full catalogue.

INSERT INTO public.modules (code, name, description, category, sort_order)
VALUES
  ('settings.view', 'View Settings', 'Manage system settings (fields, packaging, pricing units)', 'Settings', 1600)
ON CONFLICT (code) DO NOTHING;
