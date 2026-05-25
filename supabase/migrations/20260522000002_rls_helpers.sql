-- Shared helper functions for Row-Level Security policies.
--
-- All helpers are STABLE and SECURITY DEFINER so the policy evaluator can
-- inline-cache them per query, and so they read system tables (portal_users,
-- organization_memberships) without being subject to the RLS we're about to
-- add on those tables. They take auth.uid() as the implicit input.
--
-- Each helper returns false for unauthenticated callers (auth.uid() IS NULL),
-- which means RLS denies by default — a SELECT from an anonymous session
-- against an RLS-enabled table returns zero rows. Server actions that need to
-- bypass RLS continue to use the service-role client; this is intentional.

-- ─── portal_user id for the current auth.uid() ───────────────────────────
CREATE OR REPLACE FUNCTION public.current_portal_user_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM portal_users WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- ─── platform admin check ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_current_user_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM portal_users WHERE auth_user_id = auth.uid() LIMIT 1),
    false
  )
$$;

-- ─── org membership check (returns true if NULL passed in, so policies that
--     accept "org id may be null on legacy rows" can opt-in) ──────────────
CREATE OR REPLACE FUNCTION public.current_user_in_org(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Treat NULL org_id as "not-applicable, don't grant on its basis"
    CASE WHEN org_id IS NULL THEN false
    ELSE
      -- Membership row in organization_memberships
      EXISTS (
        SELECT 1
        FROM organization_memberships m
        INNER JOIN portal_users pu ON pu.id = m.user_id
        WHERE pu.auth_user_id = auth.uid()
          AND m.organization_id = org_id
          AND m.is_active = true
      )
      -- Legacy: portal_users.organisation_id (single-org users prior to Epic 10)
      OR EXISTS (
        SELECT 1 FROM portal_users pu
        WHERE pu.auth_user_id = auth.uid()
          AND pu.organisation_id = org_id
      )
    END
$$;

COMMENT ON FUNCTION public.current_portal_user_id IS
  'Returns the portal_users.id for the current Supabase Auth user, or NULL.';
COMMENT ON FUNCTION public.is_current_user_platform_admin IS
  'True if the current user has is_platform_admin = true on portal_users.';
COMMENT ON FUNCTION public.current_user_in_org IS
  'True if the current user is an active member (or legacy single-org user) of the given org_id.';
