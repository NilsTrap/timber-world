-- Nilitto company-user onboarding invariants.
-- Ordinary portal users have one active company. Platform administrators are
-- exempt because their authority is global and not derived from a company role.

CREATE OR REPLACE FUNCTION public.enforce_single_company_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  IF TG_OP = 'UPDATE' THEN
    IF OLD.user_id = NEW.user_id
       AND OLD.organization_id = NEW.organization_id
       AND OLD.is_active = true
       AND NEW.is_active = true
    THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.is_active = true
     AND NOT EXISTS (
       SELECT 1 FROM public.portal_users pu
       WHERE pu.id = NEW.user_id AND pu.is_platform_admin = true
     )
     AND EXISTS (
       SELECT 1 FROM public.organization_memberships existing
       WHERE existing.user_id = NEW.user_id
         AND existing.organization_id <> NEW.organization_id
         AND existing.is_active = true
         AND (TG_OP = 'INSERT' OR existing.id <> NEW.id)
     )
  THEN
    RAISE EXCEPTION 'SINGLE_COMPANY_MEMBERSHIP';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_memberships_single_company ON public.organization_memberships;
CREATE TRIGGER organization_memberships_single_company
  BEFORE INSERT OR UPDATE OF is_active, organization_id, user_id
  ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_company_membership();

-- Trader onboarding is explicit and stays independently revocable from client
-- book visibility. The application also requires a direct trader-customer edge.
WITH trader_group AS (
  SELECT id FROM public.access_groups WHERE key = 'trader'
)
INSERT INTO public.access_group_rights (group_id, right_type, resource, key, value)
SELECT id, 'action', 'person', 'invite', '{}'::jsonb
FROM trader_group
ON CONFLICT (group_id, right_type, resource, key) DO NOTHING;
