-- Nilitto MVP role navigation presets.
--
-- Projects is deliberately separate from legacy Orders. Access remains the
-- intersection of the organisation ceiling and a user's access-group grants.

INSERT INTO public.modules (code, name, description, category, sort_order) VALUES
  ('projects.view', 'Projects', 'View the Nilitto project workspace', 'Projects', 1650)
ON CONFLICT (code) DO NOTHING;

-- Every confirmed Nilitto persona can use Dashboard + Projects. Traders also
-- manage both company books. Group assignment remains the final user-level wall.
INSERT INTO public.organization_modules (organization_id, module_code, enabled)
SELECT o.id, v.module_code, true
FROM public.organisations o
CROSS JOIN LATERAL (
  SELECT module_code
  FROM (VALUES ('dashboard.view'), ('projects.view')) AS base(module_code)
  UNION ALL
  SELECT module_code
  FROM (VALUES ('counterparties.clients'), ('counterparties.suppliers')) AS trader(module_code)
  WHERE o.is_trader = true
) v
WHERE o.is_customer = true
   OR o.is_trader = true
   OR o.is_manufacturer = true
   OR o.is_supplier = true
   OR o.is_producer = true
ON CONFLICT (organization_id, module_code)
DO UPDATE SET enabled = EXCLUDED.enabled;

INSERT INTO public.access_groups (key, name, description, is_system, sort_order) VALUES
  ('buyer', 'Buyer', 'Buyer portal: own projects, documents, pricing and status', true, 410),
  ('trader', 'Trader', 'Nilitto trader: project workflow and both company books', true, 420),
  ('manufacturer', 'Manufacturer / Supplier', 'Supplier portal: shared projects, quotation and production work', true, 430)
ON CONFLICT (key) DO NOTHING;

-- Preserve Projects for users on the older groups while new memberships move
-- to the explicit Nilitto presets. Only the new presets omit legacy Orders.
WITH g AS (SELECT id, key FROM public.access_groups)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'module', 'portal', v.module_code, '{}'::jsonb
FROM g
JOIN (VALUES
  ('super-admin', 'projects.view'),
  ('salesperson', 'projects.view'),
  ('purchasing', 'projects.view'),
  ('client', 'projects.view'),
  ('producer', 'projects.view'),
  ('buyer', 'dashboard.view'), ('buyer', 'projects.view'),
  ('trader', 'dashboard.view'), ('trader', 'projects.view'),
  ('trader', 'counterparties.clients'), ('trader', 'counterparties.suppliers'),
  ('manufacturer', 'dashboard.view'), ('manufacturer', 'projects.view')
) AS v(group_key, module_code) ON v.group_key = g.key
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

WITH g AS (SELECT id, key FROM public.access_groups)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'visibility', 'deal', v.visibility_key, '{}'::jsonb
FROM g
JOIN (VALUES
  ('buyer', 'side.buy'),
  ('trader', 'side.sell'), ('trader', 'side.buy'), ('trader', 'spine.status'),
  ('manufacturer', 'side.sell'), ('manufacturer', 'legacy.producer')
) AS v(group_key, visibility_key) ON v.group_key = g.key
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

WITH g AS (SELECT id, key FROM public.access_groups)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'visibility', 'deal_fields', v.domain,
       jsonb_build_object('visible', true, 'editable', v.editable)
FROM g
JOIN (VALUES
  ('buyer', 'general', false), ('buyer', 'deal_terms', false),
  ('buyer', 'logistics', false), ('buyer', 'customer_identity', false),
  ('trader', 'general', true), ('trader', 'deal_terms', true),
  ('trader', 'production', true), ('trader', 'financial_docs', true),
  ('trader', 'logistics', true), ('trader', 'customer_identity', true),
  ('trader', 'supplier_identity', true), ('trader', 'chain', true),
  ('manufacturer', 'general', false), ('manufacturer', 'deal_terms', false),
  ('manufacturer', 'production', true), ('manufacturer', 'logistics', false)
) AS v(group_key, domain, editable) ON v.group_key = g.key
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

WITH g AS (SELECT id, key FROM public.access_groups)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'scope', 'deal', 'deals', to_jsonb('company'::text)
FROM g
WHERE g.key IN ('buyer', 'trader', 'manufacturer')
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

WITH g AS (SELECT id, key FROM public.access_groups)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'action', v.resource, v.action_key, '{}'::jsonb
FROM g
JOIN (VALUES
  ('buyer', 'deal', 'create'),
  ('trader', 'deal', 'create'),
  ('trader', 'counterparty', 'clients'),
  ('trader', 'counterparty', 'suppliers')
) AS v(group_key, resource, action_key) ON v.group_key = g.key
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;
