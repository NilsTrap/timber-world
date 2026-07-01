-- =============================================
-- E4 · Migrate per-user module toggles → access groups
-- Migration: 20260701000011_user_modules_to_groups.sql
--
-- Groups subsume user_modules: the app stops reading user_modules after E4
-- (the table itself is kept until E8 cleanup). Every existing non-admin
-- (user, org) module set is mapped onto a deterministic "legacy" group
-- whose rights reproduce today's behaviour EXACTLY:
--   * module rights = the user's enabled module codes
--   * row access    = side.sell + side.buy + legacy.producer (the old
--                     3-party predicate granted access via any slot)
--   * scope         = company
--   * field domains = everything visible except the pricing domains
--                     (deal_terms / margin / financial_docs), which are
--                     visible only with one of the pricing tabs — mirroring
--                     the stripOrderPricing condition; editable mirrors the
--                     orders.view full-edit / orders.tab.production rules.
-- Deterministic group key = 'legacy-' || md5(sorted module csv) → idempotent
-- re-runs, and users with identical module sets share one group. Admins
-- (role='admin') are skipped: they bypass module gates in the app and RLS.
-- =============================================

-- Signature = the EFFECTIVE module set (org ceiling ∩ user), exactly what the
-- old getUserEnabledModules returned — NOT raw user_modules. This keeps the
-- field-domain parity (has_pricing etc.) honest when the org ceiling disables
-- a tab the user row still has enabled.
CREATE TEMP TABLE _e4_sig ON COMMIT DROP AS
SELECT um.user_id,
       um.organization_id,
       string_agg(um.module_code, ',' ORDER BY um.module_code) AS sig
FROM public.user_modules um
JOIN public.portal_users pu ON pu.id = um.user_id
JOIN public.organization_modules om
  ON om.organization_id = um.organization_id
 AND om.module_code = um.module_code
 AND om.enabled = true
WHERE um.enabled = true
  AND pu.role <> 'admin'
GROUP BY um.user_id, um.organization_id;

-- 1. One legacy group per distinct module-set signature
INSERT INTO public.access_groups (key, name, description, is_system, sort_order)
SELECT DISTINCT
  'legacy-' || substr(md5(sig), 1, 8),
  'Legacy modules (' || substr(md5(sig), 1, 8) || ')',
  'Migrated 1:1 from per-user module toggles (E4). Reassign members to a proper group, then delete.',
  false,
  5000
FROM _e4_sig
ON CONFLICT (key) DO NOTHING;

-- 2. Module rights = the signature's codes
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT DISTINCT g.id, 'module', 'portal', m.code, '{}'::jsonb
FROM (SELECT DISTINCT sig FROM _e4_sig) s
JOIN public.access_groups g ON g.key = 'legacy-' || substr(md5(s.sig), 1, 8)
CROSS JOIN LATERAL unnest(string_to_array(s.sig, ',')) AS m(code)
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

-- 3. Row access parity: any legacy party slot grants the row
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT DISTINCT g.id, 'visibility', 'deal', v.vis_key, '{}'::jsonb
FROM (SELECT DISTINCT sig FROM _e4_sig) s
JOIN public.access_groups g ON g.key = 'legacy-' || substr(md5(s.sig), 1, 8)
CROSS JOIN (VALUES ('side.sell'), ('side.buy'), ('legacy.producer')) AS v(vis_key)
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT DISTINCT g.id, 'scope', 'deal', 'deals', to_jsonb('company'::text)
FROM (SELECT DISTINCT sig FROM _e4_sig) s
JOIN public.access_groups g ON g.key = 'legacy-' || substr(md5(s.sig), 1, 8)
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

-- 4. Field-domain parity (see header). Only granted domains get a row.
WITH f AS (
  SELECT g.id AS group_id,
         a.arr @> ARRAY['orders.view'] AS has_view,
         (a.arr && ARRAY['orders.tab.sales', 'orders.tab.analytics', 'orders.tab.prices']) AS has_pricing,
         a.arr @> ARRAY['orders.tab.production'] AS has_prod
  FROM (SELECT DISTINCT sig FROM _e4_sig) s
  CROSS JOIN LATERAL (SELECT string_to_array(s.sig, ',') AS arr) a
  JOIN public.access_groups g ON g.key = 'legacy-' || substr(md5(s.sig), 1, 8)
)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT f.group_id, 'visibility', 'deal_fields', d.domain,
       jsonb_build_object('visible', true, 'editable', d.edit)
FROM f
CROSS JOIN LATERAL (
  VALUES
    ('general',           true,                            f.has_view),
    -- logistics editable with the production tab too: dateLoaded/plannedDate
    -- were in PRODUCTION_EDIT_FIELDS (production-tab users could edit them)
    ('logistics',         true,                            f.has_view OR f.has_prod),
    ('production',        true,                            f.has_view OR f.has_prod),
    ('customer_identity', true,                            f.has_view),
    ('supplier_identity', true,                            f.has_view),
    ('chain',             true,                            f.has_view),
    ('deal_terms',        f.has_pricing,                   f.has_pricing AND f.has_view),
    ('margin',            f.has_pricing,                   f.has_pricing AND f.has_view),
    ('financial_docs',    f.has_pricing,                   f.has_pricing AND f.has_view)
) AS d(domain, vis, edit)
WHERE d.vis
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;

-- 5. Assign each (user, org) to its legacy group
INSERT INTO public.user_access_groups (user_id, organization_id, group_id)
SELECT s.user_id, s.organization_id, g.id
FROM _e4_sig s
JOIN public.access_groups g ON g.key = 'legacy-' || substr(md5(s.sig), 1, 8)
ON CONFLICT (user_id, organization_id, group_id) DO NOTHING;
