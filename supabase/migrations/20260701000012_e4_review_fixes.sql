-- =============================================
-- E4 · review fixes (DB side)
-- Migration: 20260701000012_e4_review_fixes.sql
--
-- Finding [1] (high): the rewritten current_user_shares_context_with_org
-- gates the forward trading-partner arm on the counterparty action rights,
-- but the legacy-parity groups from 20260701000011 grant no action rights.
-- A migrated user therefore loses visibility of trading-partner org rows
-- they had no prior accessible deal with — regressing the empty
-- Customer/Manufacturer order-picker bug that 20260601000002 fixed, and
-- failing server-side party validation on create/edit.
--
-- Fix: grant every legacy-* group BOTH counterparty action rights, which
-- reproduces the old unconditional partner-org visibility. System groups
-- (salesperson/purchasing) keep their single-book right by design (the new
-- walled model); only the transitional legacy groups get both. These groups
-- (and their extra rights) disappear in E8 when users are reassigned to
-- proper groups.
-- =============================================

INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT g.id, 'action', 'counterparty', v.book, '{}'::jsonb
FROM public.access_groups g
CROSS JOIN (VALUES ('clients'), ('suppliers')) AS v(book)
WHERE g.key LIKE 'legacy-%'
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;
