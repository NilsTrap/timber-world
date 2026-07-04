-- K4 · Membership-model reconciliation backfill (idempotent, additive).
--
-- Two parallel sources of truth exist for "which org does a user belong to":
--   1. organization_memberships (user_id, organization_id, is_active, is_primary)
--   2. legacy portal_users.organisation_id  ("home org", pre-Epic-10)
-- Both are still written and read. The RLS helper current_user_in_org() grants
-- on EITHER an active membership OR a legacy home-org match, so the legacy
-- column is LOAD-BEARING and is NOT dropped here.
--
-- Some users (notably anyone created via createOrganisationUser, which writes
-- portal_users.organisation_id but does NOT create a membership row) are linked
-- to their company ONLY via the legacy column and have no membership. This
-- backfill gives every such user an active, primary membership for their home
-- org — WITHOUT ever creating a second primary for a user who already has one.
--
-- Idempotent: re-running is a no-op (NOT EXISTS guards + conditional promote).
-- Additive only: never deletes, deactivates, drops, or flips an existing
-- primary onto a different org. Safe to run repeatedly on staging AND prod.
--
-- ⚠ PROD CUTOVER: this exact file must run during the E8 prod cutover (prod is
-- not yet backfilled). See docs/membership-reconciliation-report.md.
--
-- Conflict target is the unique constraint org_memberships_unique
-- (user_id, organization_id) — verified in 20260201000001_epic10_core_tables.sql.

-- ── S1 · Insert the missing home-org membership row ────────────────────────
-- For every user with a home org but NO membership row for that org, insert an
-- active membership. Mark it PRIMARY only when the user has no primary anywhere
-- (so we never manufacture a duplicate primary). is_active=true is safe here:
-- the row is brand-new, there is no prior admin intent to preserve.
INSERT INTO public.organization_memberships (user_id, organization_id, is_active, is_primary)
SELECT
  pu.id,
  pu.organisation_id,
  true,
  NOT EXISTS (
    SELECT 1 FROM public.organization_memberships mp
    WHERE mp.user_id = pu.id
      AND COALESCE(mp.is_primary, false) = true
  )
FROM public.portal_users pu
WHERE pu.organisation_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.user_id = pu.id
      AND m.organization_id = pu.organisation_id
  );

-- ── S2 · Promote the home-org membership to primary where the user has none ─
-- Covers users whose home-org membership row already existed but is not primary
-- AND who have no primary on any org. Never touches a user who already has a
-- primary (guard), so it can never create a duplicate primary or move a primary
-- off another org. Only the home-org row is eligible.
UPDATE public.organization_memberships m
SET is_primary = true
FROM public.portal_users pu
WHERE m.user_id = pu.id
  AND m.organization_id = pu.organisation_id
  AND pu.organisation_id IS NOT NULL
  AND COALESCE(m.is_primary, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_memberships mp
    WHERE mp.user_id = pu.id
      AND COALESCE(mp.is_primary, false) = true
  );

-- NOTE (deliberate omission): we do NOT force-reactivate an EXISTING inactive
-- home-org membership. A deactivated membership may reflect intentional admin
-- action, and RLS access to the home org is granted via the legacy branch of
-- current_user_in_org() regardless of membership.is_active. Reactivation would
-- be a semantic mutation with no access benefit, so it is out of scope. (There
-- are 0 such rows on staging at backfill time.)
