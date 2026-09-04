-- Restore the canonical Nilitto access preset for active, group-less
-- memberships created before role-group provisioning became mandatory.
-- Multi-persona organisations are deliberately excluded: their access must be
-- chosen explicitly rather than inferred by a data repair.
WITH eligible_memberships AS (
  SELECT
    membership.user_id,
    membership.organization_id,
    CASE
      WHEN organisation.is_customer THEN 'buyer'
      WHEN organisation.is_trader THEN 'trader'
      ELSE 'manufacturer'
    END AS group_key
  FROM public.organization_memberships membership
  JOIN public.portal_users portal_user
    ON portal_user.id = membership.user_id
   AND portal_user.is_active = true
  JOIN public.organisations organisation
    ON organisation.id = membership.organization_id
   AND organisation.is_active = true
  WHERE membership.is_active = true
    AND (
      organisation.is_customer::integer
      + organisation.is_trader::integer
      + (organisation.is_manufacturer OR organisation.is_supplier OR organisation.is_producer)::integer
    ) = 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_access_groups existing_assignment
      WHERE existing_assignment.user_id = membership.user_id
        AND existing_assignment.organization_id = membership.organization_id
    )
)
INSERT INTO public.user_access_groups (user_id, organization_id, group_id)
SELECT eligible.user_id, eligible.organization_id, role_group.id
FROM eligible_memberships eligible
JOIN public.access_groups role_group
  ON role_group.key = eligible.group_key
 AND role_group.is_system = true
ON CONFLICT (user_id, organization_id, group_id) DO NOTHING;
