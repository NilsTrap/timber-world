-- Backfill organization_memberships for legacy non-admin users.
--
-- Some older users are linked to their company only via the legacy
-- portal_users.organisation_id field and have NO organization_memberships row.
-- getSession resolves the current org from membership rows; its legacy fallback
-- depends on an organisations join that the 2026-05-22 RLS rollout now returns
-- empty for these users, so their current org fails to resolve and org-scoped
-- pages (e.g. Orders) 404. A real membership sets the current org directly and
-- removes the dependence on that fragile fallback.
--
-- For every non-admin user that has a legacy org but no membership for it,
-- create one active, primary membership. Idempotent via the NOT EXISTS guard.

INSERT INTO public.organization_memberships (user_id, organization_id, is_active, is_primary)
SELECT pu.id, pu.organisation_id, true, true
FROM public.portal_users pu
WHERE pu.organisation_id IS NOT NULL
  AND COALESCE(pu.is_platform_admin, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.user_id = pu.id
      AND m.organization_id = pu.organisation_id
  );
