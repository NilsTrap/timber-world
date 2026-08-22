-- Super-admin person onboarding: one active primary membership per user.
-- All functions are service-role only. The portal/MCP action layer performs the
-- exact portal_users.is_platform_admin + active-account authorization check.

-- Repair historical duplicate primaries deterministically before adding the
-- partial unique index. Prefer the legacy home organisation, then the oldest row.
WITH ranked AS (
  SELECT m.id,
         row_number() OVER (
           PARTITION BY m.user_id
           ORDER BY (m.organization_id = pu.organisation_id) DESC,
                    m.created_at ASC,
                    m.id ASC
         ) AS rn
  FROM public.organization_memberships m
  JOIN public.portal_users pu ON pu.id = m.user_id
  WHERE m.is_active = true AND m.is_primary = true
)
UPDATE public.organization_memberships m
SET is_primary = false
FROM ranked r
WHERE m.id = r.id AND r.rn > 1;

-- Every user with an active membership receives exactly one primary.
WITH missing AS (
  SELECT DISTINCT ON (m.user_id) m.id
  FROM public.organization_memberships m
  JOIN public.portal_users pu ON pu.id = m.user_id
  WHERE m.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_memberships p
      WHERE p.user_id = m.user_id AND p.is_active = true AND p.is_primary = true
    )
  ORDER BY m.user_id,
           (m.organization_id = pu.organisation_id) DESC,
           m.created_at ASC,
           m.id ASC
)
UPDATE public.organization_memberships m
SET is_primary = true
FROM missing x
WHERE m.id = x.id;

CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_one_active_primary
  ON public.organization_memberships (user_id)
  WHERE is_active = true AND is_primary = true;

CREATE OR REPLACE FUNCTION public.admin_create_portal_user(
  p_email text,
  p_name text,
  p_organization_id uuid,
  p_invited_by uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = p_organization_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_DENIED';
  END IF;

  INSERT INTO public.portal_users (
    email, name, role, organisation_id, is_active, status
  ) VALUES (
    lower(trim(p_email)), trim(p_name), 'user', p_organization_id, true, 'created'
  ) RETURNING id INTO v_user_id;

  INSERT INTO public.organization_memberships (
    user_id, organization_id, is_active, is_primary, invited_at, invited_by
  ) VALUES (
    v_user_id, p_organization_id, true, true, now(), p_invited_by
  );

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_user_membership(
  p_user_id uuid,
  p_organization_id uuid,
  p_make_primary boolean DEFAULT false,
  p_invited_by uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_primary boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  IF NOT EXISTS (SELECT 1 FROM public.portal_users WHERE id = p_user_id)
     OR NOT EXISTS (
       SELECT 1 FROM public.organisations
       WHERE id = p_organization_id AND is_active = true
     ) THEN
    RAISE EXCEPTION 'ONBOARDING_DENIED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER';
  END IF;

  INSERT INTO public.organization_memberships (
    user_id, organization_id, is_active, is_primary, invited_at, invited_by
  ) VALUES (
    p_user_id, p_organization_id, true, false, now(), p_invited_by
  )
  ON CONFLICT (user_id, organization_id) DO UPDATE
    SET is_active = true,
        is_primary = false,
        invited_at = COALESCE(organization_memberships.invited_at, EXCLUDED.invited_at),
        invited_by = COALESCE(organization_memberships.invited_by, EXCLUDED.invited_by);

  -- Reactivation never restores historical access.
  DELETE FROM public.user_access_groups
  WHERE user_id = p_user_id AND organization_id = p_organization_id;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = p_user_id AND is_active = true AND is_primary = true
  ) INTO v_has_primary;

  IF p_make_primary OR NOT v_has_primary THEN
    UPDATE public.organization_memberships
    SET is_primary = false
    WHERE user_id = p_user_id AND is_primary = true;

    UPDATE public.organization_memberships
    SET is_primary = true
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND is_active = true;

    UPDATE public.portal_users
    SET organisation_id = p_organization_id, updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_primary_membership(
  p_user_id uuid,
  p_organization_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_DENIED';
  END IF;

  UPDATE public.organization_memberships
  SET is_primary = false
  WHERE user_id = p_user_id AND is_primary = true;

  UPDATE public.organization_memberships
  SET is_primary = true
  WHERE user_id = p_user_id
    AND organization_id = p_organization_id
    AND is_active = true;

  UPDATE public.portal_users
  SET organisation_id = p_organization_id, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_membership_active(
  p_user_id uuid,
  p_organization_id uuid,
  p_is_active boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.organization_memberships%ROWTYPE;
  v_active_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT * INTO v_target
  FROM public.organization_memberships
  WHERE user_id = p_user_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'ONBOARDING_DENIED'; END IF;

  IF p_is_active THEN
    UPDATE public.organization_memberships
    SET is_active = true, is_primary = false
    WHERE id = v_target.id;
    -- Reactivation is membership-only: no historical rights return.
    DELETE FROM public.user_access_groups
    WHERE user_id = p_user_id AND organization_id = p_organization_id;
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_memberships
      WHERE user_id = p_user_id AND is_active = true AND is_primary = true
    ) THEN
      UPDATE public.organization_memberships
      SET is_primary = true
      WHERE id = v_target.id;
      UPDATE public.portal_users
      SET organisation_id = p_organization_id, updated_at = now()
      WHERE id = p_user_id;
    END IF;
    RETURN;
  END IF;

  SELECT count(*) INTO v_active_count
  FROM public.organization_memberships
  WHERE user_id = p_user_id AND is_active = true;

  IF v_target.is_primary OR v_active_count <= 1 THEN
    RAISE EXCEPTION 'PRIMARY_OR_ONLY_MEMBERSHIP';
  END IF;

  UPDATE public.organization_memberships
  SET is_active = false, is_primary = false
  WHERE id = v_target.id;

  DELETE FROM public.user_access_groups
  WHERE user_id = p_user_id AND organization_id = p_organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_membership_groups(
  p_user_id uuid,
  p_organization_id uuid,
  p_group_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested integer;
  v_valid integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = p_user_id
      AND organization_id = p_organization_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_DENIED';
  END IF;

  SELECT count(DISTINCT x) INTO v_requested FROM unnest(COALESCE(p_group_ids, '{}'::uuid[])) x;
  SELECT count(*) INTO v_valid
  FROM (
    SELECT DISTINCT g.id
    FROM unnest(COALESCE(p_group_ids, '{}'::uuid[])) requested(id)
    JOIN public.access_groups g ON g.id = requested.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.access_group_rights r
      WHERE r.group_id = g.id AND r.right_type = 'module' AND r.resource = 'portal'
    ) OR EXISTS (
      SELECT 1
      FROM public.access_group_rights r
      JOIN public.organization_modules om
        ON om.organization_id = p_organization_id
       AND om.module_code = r.key
       AND om.enabled = true
      WHERE r.group_id = g.id AND r.right_type = 'module' AND r.resource = 'portal'
    )
  ) allowed;

  IF v_valid <> v_requested THEN RAISE EXCEPTION 'ACCESS_ABOVE_ORG_CEILING'; END IF;

  DELETE FROM public.user_access_groups
  WHERE user_id = p_user_id AND organization_id = p_organization_id;

  INSERT INTO public.user_access_groups (user_id, organization_id, group_id)
  SELECT p_user_id, p_organization_id, x
  FROM unnest(COALESCE(p_group_ids, '{}'::uuid[])) x
  ON CONFLICT DO NOTHING;

  RETURN v_valid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_portal_user(text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_upsert_user_membership(uuid, uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_primary_membership(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_membership_active(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_membership_groups(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_portal_user(text, text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_user_membership(uuid, uuid, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_primary_membership(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_membership_active(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_membership_groups(uuid, uuid, uuid[]) TO service_role;

COMMENT ON INDEX public.organization_memberships_one_active_primary IS
  'Concurrency-safe invariant: a portal user has at most one active primary organisation.';
