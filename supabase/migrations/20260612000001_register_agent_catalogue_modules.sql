-- Register the new portal areas as grantable modules so admins can enable them
-- per organisation (organization_modules) and per user (user_modules):
--   agents.view        → /admin/agents        (agent management)
--   agent-orders.view  → /admin/agent-orders  (agent order review)
--   agent-manual.view  → /admin/agent-manual  (reference page)
--   catalogue.view     → /admin/catalog/**    (product catalogue management)
--
-- Note: user-facing spelling is "Catalogue"; the route stays /admin/catalog
-- (same label-vs-internal-name pattern as CMS ↔ marketing.view).

INSERT INTO public.modules (code, name, description, category, sort_order)
VALUES
  ('agents.view',        'View Agents',        'Manage sales agents',                    'Agents',       1200),
  ('agent-orders.view',  'View Agent Orders',  'Review and confirm agent orders',        'Agent Orders', 1300),
  ('agent-manual.view',  'View Agent Manual',  'Agent manual reference page',            'Agent Manual', 1400),
  ('catalogue.view',     'View Catalogue',     'Manage the product catalogue',           'Catalogue',    1500)
ON CONFLICT (code) DO NOTHING;
