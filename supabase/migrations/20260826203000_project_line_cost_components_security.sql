-- Correct the initial rollout policy where the schema migration was applied
-- before its seller-only access policy was finalized.

CREATE OR REPLACE FUNCTION public.current_user_deal_terms_access(p_org UUID, p_editable BOOLEAN DEFAULT false)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.is_current_user_platform_admin() OR EXISTS (
    SELECT 1
    FROM public.user_access_groups uag
    JOIN public.portal_users pu ON pu.id = uag.user_id
    JOIN public.access_group_rights r ON r.group_id = uag.group_id
    WHERE pu.auth_user_id = auth.uid()
      AND uag.organization_id = p_org
      AND r.right_type = 'visibility' AND r.resource = 'deal_fields' AND r.key = 'deal_terms'
      AND COALESCE((r.value->>'visible')::BOOLEAN, false)
      AND (NOT p_editable OR COALESCE((r.value->>'editable')::BOOLEAN, false))
  ), false)
$$;

DROP POLICY IF EXISTS order_line_item_components_rw ON public.order_line_item_components;
DROP POLICY IF EXISTS order_line_item_components_select ON public.order_line_item_components;
DROP POLICY IF EXISTS order_line_item_components_write ON public.order_line_item_components;

CREATE POLICY order_line_item_components_select ON public.order_line_item_components
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_line_items line
    JOIN public.orders deal ON deal.id = line.order_id
    WHERE line.id = order_line_item_id AND (
      public.is_current_user_platform_admin()
      OR (public.current_user_in_org(deal.seller_organisation_id)
          AND public.current_user_deal_terms_access(deal.seller_organisation_id, false))
    )
  )
);

CREATE POLICY order_line_item_components_write ON public.order_line_item_components
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_line_items line
    JOIN public.orders deal ON deal.id = line.order_id
    WHERE line.id = order_line_item_id AND (
      public.is_current_user_platform_admin()
      OR (public.current_user_in_org(deal.seller_organisation_id)
          AND public.current_user_deal_terms_access(deal.seller_organisation_id, true))
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.order_line_items line
    JOIN public.orders deal ON deal.id = line.order_id
    WHERE line.id = order_line_item_id AND (
      public.is_current_user_platform_admin()
      OR (public.current_user_in_org(deal.seller_organisation_id)
          AND public.current_user_deal_terms_access(deal.seller_organisation_id, true))
    )
  )
);
