-- =============================================
-- E4 · Group-and-rights access — schema + seeded default groups
-- Migration: 20260701000009_access_groups.sql
--
-- Global groups (one platform-wide set, house-admin editable) with per-org
-- assignment: a user is assigned groups PER organisation membership
-- (Edgars steer 2026-07-01). Groups SUBSUME user-level module grants:
--   effective modules = organization_modules (org ceiling)
--                       ∩ (∪ module rights of the user's groups in that org)
-- user_modules stops being read by the app (table kept until E8 cleanup;
-- 20260701000011 maps its rows onto groups).
--
-- One rights table covers every right kind (right_type):
--   module     / portal      / <module_code>            — subsumed module grants
--   visibility / deal        / side.sell|side.buy|legacy.producer|spine.status
--                                                       — ROW-level deal access, org-relative
--   visibility / deal_fields / <domain>  {visible,editable}
--                                                       — field-domain grants (registry in app)
--   field      / deal        / <fieldKey> {visible,editable}
--                                                       — per-field overrides (win over domain)
--   scope      / deal        / deals  "mine"|"company"|"all"
--   action     / counterparty/ clients|suppliers        — walled address books (§9.3)
--   action     / deal        / create                   — may seed spines on deal creation
-- =============================================

-- 1. Tables --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.access_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.access_group_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.access_groups(id) ON DELETE CASCADE,
  right_type TEXT NOT NULL CHECK (right_type IN ('module', 'action', 'visibility', 'field', 'scope')),
  resource TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, right_type, resource, key)
);

CREATE INDEX IF NOT EXISTS idx_access_group_rights_group
  ON public.access_group_rights(group_id);

CREATE TABLE IF NOT EXISTS public.user_access_groups (
  user_id UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.access_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_access_groups_user_org
  ON public.user_access_groups(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_user_access_groups_group
  ON public.user_access_groups(group_id);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supplier flag: the supplier address book = is_supplier OR is_producer;
-- the client book = is_customer (flags added 20260609000001).
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS is_supplier BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'access_groups_updated_at') THEN
    CREATE TRIGGER access_groups_updated_at
      BEFORE UPDATE ON public.access_groups
      FOR EACH ROW EXECUTE FUNCTION public.deals_set_updated_at();
  END IF;
END $$;

-- 2. RLS ------------------------------------------------------------------
-- Config tables follow the deal_gates recipe: reads open to authenticated
-- where harmless, writes platform-admin only. The app resolves rights via
-- the service-role client; RLS helpers are SECURITY DEFINER.

ALTER TABLE public.access_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_group_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_groups_select ON public.access_groups;
CREATE POLICY access_groups_select ON public.access_groups
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS access_groups_write_admin ON public.access_groups;
CREATE POLICY access_groups_write_admin ON public.access_groups
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- Rights: a user may read the rights of groups they belong to; admins all.
DROP POLICY IF EXISTS access_group_rights_select ON public.access_group_rights;
CREATE POLICY access_group_rights_select ON public.access_group_rights
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_access_groups uag
      WHERE uag.group_id = access_group_rights.group_id
        AND uag.user_id = public.current_portal_user_id()
    )
  );

DROP POLICY IF EXISTS access_group_rights_write_admin ON public.access_group_rights;
CREATE POLICY access_group_rights_write_admin ON public.access_group_rights
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

DROP POLICY IF EXISTS user_access_groups_select ON public.user_access_groups;
CREATE POLICY user_access_groups_select ON public.user_access_groups
  FOR SELECT TO authenticated
  USING (
    user_id = public.current_portal_user_id()
    OR public.is_current_user_platform_admin()
  );

DROP POLICY IF EXISTS user_access_groups_write_admin ON public.user_access_groups;
CREATE POLICY user_access_groups_write_admin ON public.user_access_groups
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

DROP POLICY IF EXISTS platform_settings_select ON public.platform_settings;
CREATE POLICY platform_settings_select ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS platform_settings_write_admin ON public.platform_settings;
CREATE POLICY platform_settings_write_admin ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- 3. Module registry + defaults -------------------------------------------

INSERT INTO public.modules (code, name, description, category, sort_order) VALUES
  ('counterparties.clients', 'Clients Address Book',
   'View and manage client counterparty records (walled from suppliers)', 'Counterparties', 1700),
  ('counterparties.suppliers', 'Suppliers Address Book',
   'View and manage supplier/producer counterparty records (walled from clients)', 'Counterparties', 1710)
ON CONFLICT (code) DO NOTHING;

-- Org ceiling: enable the address books for internal orgs so the house can use them.
INSERT INTO public.organization_modules (organization_id, module_code, enabled)
SELECT o.id, m.code, true
FROM public.organisations o
CROSS JOIN (VALUES ('counterparties.clients'), ('counterparties.suppliers')) AS m(code)
WHERE o.is_external = false
ON CONFLICT (organization_id, module_code) DO NOTHING;

INSERT INTO public.platform_settings (key, value) VALUES
  ('purchasing_may_reuse_clients', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Seeded default groups (spec §9.2 table; all editable in-app) ----------

INSERT INTO public.access_groups (key, name, description, is_system, sort_order) VALUES
  ('super-admin',  'Super admin',  'The owner: every deal in every chain, all fields, full configuration', true, 100),
  ('salesperson',  'Salesperson',  'Sell side: own sell deals + client records; no upstream deals, supplier identity or upstream prices', true, 200),
  ('purchasing',   'Purchasing',   'Buy side: own buy deals + supplier records; no sell-side prices or customer identity', true, 300),
  ('client',       'Client',       'Customer login: their own deal only — spec, documents, status', true, 400),
  ('producer',     'Producer',     'Factory login: only the production deal where they are the seller', true, 500),
  ('accounting',   'Accounting',   'Financial fields of the entity''s deals — invoices, payment status', true, 600),
  ('warehouse',    'Warehouse',    'Logistics fields of deals — packing, loading, quantities, delivery; no pricing', true, 700)
ON CONFLICT (key) DO NOTHING;

-- Rights seeds. Idempotent via ON CONFLICT on (group_id, right_type, resource, key).
WITH g AS (SELECT id, key FROM public.access_groups)

-- 4a. Module rights
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'module', 'portal', v.module_code, '{}'::jsonb
FROM g
JOIN (VALUES
  -- Super admin: every registered module (admins bypass in-app, seeded for completeness)
  ('super-admin', 'dashboard.view'), ('super-admin', 'inventory.view'), ('super-admin', 'production.view'),
  ('super-admin', 'shipments.view'), ('super-admin', 'orders.view'), ('super-admin', 'organizations.view'),
  ('super-admin', 'crm.view'), ('super-admin', 'marketing.view'), ('super-admin', 'quotes.view'),
  ('super-admin', 'uk-staircase-pricing.view'), ('super-admin', 'competitor-pricing.view'),
  ('super-admin', 'agents.view'), ('super-admin', 'agent-orders.view'), ('super-admin', 'agent-manual.view'),
  ('super-admin', 'catalogue.view'), ('super-admin', 'settings.view'),
  ('super-admin', 'orders.tab.list'), ('super-admin', 'orders.tab.prices'), ('super-admin', 'orders.tab.sales'),
  ('super-admin', 'orders.tab.production'), ('super-admin', 'orders.tab.analytics'),
  ('super-admin', 'counterparties.clients'), ('super-admin', 'counterparties.suppliers'),

  ('salesperson', 'dashboard.view'), ('salesperson', 'orders.view'),
  ('salesperson', 'orders.tab.list'), ('salesperson', 'orders.tab.sales'), ('salesperson', 'orders.tab.prices'),
  ('salesperson', 'counterparties.clients'),

  ('purchasing', 'dashboard.view'), ('purchasing', 'orders.view'), ('purchasing', 'orders.tab.list'),
  ('purchasing', 'counterparties.suppliers'),

  ('client', 'orders.view'), ('client', 'orders.tab.list'),

  ('producer', 'orders.view'), ('producer', 'orders.tab.list'), ('producer', 'orders.tab.production'),

  ('accounting', 'dashboard.view'), ('accounting', 'orders.view'),
  ('accounting', 'orders.tab.list'), ('accounting', 'orders.tab.sales'),

  ('warehouse', 'orders.view'), ('warehouse', 'orders.tab.list'),
  ('warehouse', 'shipments.view'), ('warehouse', 'inventory.view')
) AS v(group_key, module_code) ON v.group_key = g.key
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

-- 4b. Deal row-level visibility (org-relative: the same keys work for
-- counterparty logins — a Producer org user holds side.sell because their
-- org is the SELLER on the production buy-leg).
WITH g AS (SELECT id, key FROM public.access_groups)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'visibility', 'deal', v.vis_key, '{}'::jsonb
FROM g
JOIN (VALUES
  ('super-admin', 'side.sell'), ('super-admin', 'side.buy'),
  ('super-admin', 'legacy.producer'), ('super-admin', 'spine.status'),
  ('salesperson', 'side.sell'),
  ('purchasing',  'side.buy'),
  ('client',      'side.buy'),
  -- legacy.producer is TRANSITIONAL: grants access via the legacy third
  -- party slot for the un-migrated 3-party orders; remove in E8.
  ('producer',    'side.sell'), ('producer', 'legacy.producer'),
  ('accounting',  'side.sell'), ('accounting', 'side.buy'),
  ('warehouse',   'side.sell'), ('warehouse', 'side.buy')
) AS v(group_key, vis_key) ON v.group_key = g.key
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

-- 4c. Field-domain grants (registry of domains lives in the app:
-- general, deal_terms, production, margin, financial_docs, logistics,
-- customer_identity, supplier_identity, chain). Deny by default:
-- an ungranted domain is invisible; margin/chain seeded to NO group
-- (platform admins only, per steer).
WITH g AS (SELECT id, key FROM public.access_groups)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'visibility', 'deal_fields', v.domain,
       jsonb_build_object('visible', true, 'editable', v.editable)
FROM g
JOIN (VALUES
  ('super-admin', 'general', true), ('super-admin', 'deal_terms', true),
  ('super-admin', 'production', true), ('super-admin', 'margin', true),
  ('super-admin', 'financial_docs', true), ('super-admin', 'logistics', true),
  ('super-admin', 'customer_identity', true), ('super-admin', 'supplier_identity', true),
  ('super-admin', 'chain', true),

  ('salesperson', 'general', true), ('salesperson', 'deal_terms', true),
  ('salesperson', 'financial_docs', false), ('salesperson', 'logistics', true),
  ('salesperson', 'customer_identity', true),

  ('purchasing', 'general', true), ('purchasing', 'deal_terms', true),
  ('purchasing', 'financial_docs', false), ('purchasing', 'logistics', true),
  ('purchasing', 'supplier_identity', true),

  ('client', 'general', false), ('client', 'deal_terms', false), ('client', 'logistics', false),
  ('client', 'customer_identity', false),

  ('producer', 'general', false), ('producer', 'deal_terms', false),
  ('producer', 'production', true), ('producer', 'logistics', false),

  ('accounting', 'general', false), ('accounting', 'deal_terms', false),
  ('accounting', 'financial_docs', true),

  ('warehouse', 'general', true), ('warehouse', 'logistics', true)
) AS v(group_key, domain, editable) ON v.group_key = g.key
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

-- 4d. Scope
WITH g AS (SELECT id, key FROM public.access_groups)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'scope', 'deal', 'deals', to_jsonb(v.scope)
FROM g
JOIN (VALUES
  ('super-admin', 'all'),
  ('salesperson', 'company'),
  ('purchasing',  'company'),
  ('client',      'company'),
  ('producer',    'company'),
  ('accounting',  'company'),
  ('warehouse',   'company')
) AS v(group_key, scope) ON v.group_key = g.key
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

-- 4e. Action rights: address books + deal creation (spine seeding)
WITH g AS (SELECT id, key FROM public.access_groups)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'action', v.resource, v.action_key, '{}'::jsonb
FROM g
JOIN (VALUES
  ('super-admin', 'counterparty', 'clients'), ('super-admin', 'counterparty', 'suppliers'),
  ('super-admin', 'deal', 'create'),
  ('salesperson', 'counterparty', 'clients'), ('salesperson', 'deal', 'create'),
  ('purchasing',  'counterparty', 'suppliers'), ('purchasing', 'deal', 'create')
) AS v(group_key, resource, action_key) ON v.group_key = g.key
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

COMMENT ON TABLE public.access_groups IS 'E4: global access groups (spec §9.2); users inherit rights from groups via user_access_groups';
COMMENT ON TABLE public.access_group_rights IS 'E4: rights of a group — module/action/visibility/field/scope rows; see 20260701000009 header for the namespace map';
COMMENT ON TABLE public.user_access_groups IS 'E4: per-org group assignment (user_id, organization_id, group_id)';
COMMENT ON TABLE public.platform_settings IS 'E4: admin-editable platform-wide settings (e.g. purchasing_may_reuse_clients, spec §9.3)';
