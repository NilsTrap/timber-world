-- Backfill user-level module grants from org-level grants, so that flipping the
-- portal page gates from org-only (orgHasModule) to two-layer
-- (getUserEnabledModules = org ∩ user) does NOT lock out existing users.
--
-- Until now, dashboard/inventory/production/shipments/marketing/quotes/crm/
-- organizations pages only checked the ORG layer. Every active member of an org
-- therefore effectively saw whatever the org had enabled, regardless of their
-- per-user checkbox. Flipping to the intended two-layer rule would suddenly
-- require a matching user_modules row — which some members are missing.
--
-- This mirrors every org-enabled *registry* module down to each active member as
-- an enabled user_modules row, but only where no row exists yet. An explicit
-- per-user DISABLE (enabled = false) is preserved (ON CONFLICT DO NOTHING) — the
-- two-layer flip will then correctly enforce that admin intent.
--
-- Registry-only filter excludes stale non-registry codes (production.*/shipments.*)
-- which are dropped separately in 20260613000003.

INSERT INTO public.user_modules (user_id, organization_id, module_code, enabled)
SELECT m.user_id, om.organization_id, om.module_code, true
FROM public.organization_modules om
JOIN public.organization_memberships m
  ON m.organization_id = om.organization_id
 AND m.is_active = true
WHERE om.enabled = true
  AND om.module_code IN (SELECT code FROM public.modules)
ON CONFLICT (user_id, organization_id, module_code) DO NOTHING;
