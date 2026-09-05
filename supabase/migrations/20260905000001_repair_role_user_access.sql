-- Repair the Nilitto role module ceiling and the missing default group left by
-- earlier partial organisation-user creation attempts.

INSERT INTO public.organization_modules (organization_id, module_code, enabled)
SELECT o.id, required.module_code, true
FROM public.organisations o
CROSS JOIN LATERAL (
  SELECT module_code
  FROM (VALUES ('dashboard.view'), ('projects.view')) AS base(module_code)
  UNION ALL
  SELECT module_code
  FROM (VALUES ('counterparties.clients'), ('counterparties.suppliers')) AS trader(module_code)
  WHERE o.is_trader = true
) required
WHERE o.is_active = true
  AND (
    (o.is_customer = true)::integer
    + (o.is_trader = true)::integer
    + (o.is_manufacturer = true OR o.is_supplier = true OR o.is_producer = true)::integer
  ) = 1
ON CONFLICT (organization_id, module_code)
DO UPDATE SET enabled = true;

WITH single_role_organisations AS (
  SELECT o.id,
    CASE
      WHEN o.is_customer = true THEN 'buyer'
      WHEN o.is_trader = true THEN 'trader'
      ELSE 'manufacturer'
    END AS group_key
  FROM public.organisations o
  WHERE o.is_active = true
    AND (
      (o.is_customer = true)::integer
      + (o.is_trader = true)::integer
      + (o.is_manufacturer = true OR o.is_supplier = true OR o.is_producer = true)::integer
    ) = 1
)
INSERT INTO public.user_access_groups (user_id, organization_id, group_id)
SELECT membership.user_id, membership.organization_id, access_group.id
FROM public.organization_memberships membership
JOIN single_role_organisations organisation ON organisation.id = membership.organization_id
JOIN public.access_groups access_group
  ON access_group.key = organisation.group_key
 AND access_group.is_system = true
WHERE membership.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_access_groups existing
    WHERE existing.user_id = membership.user_id
      AND existing.organization_id = membership.organization_id
  )
ON CONFLICT DO NOTHING;
