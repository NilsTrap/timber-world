-- MVP manufacturing specification costing.
-- The customer-facing deliverable stays in order_line_items. Materials,
-- manufacturing operations and ancillary services explain the internal cost.

CREATE TABLE IF NOT EXISTS public.order_line_item_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_item_id UUID NOT NULL REFERENCES public.order_line_items(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL CHECK (component_type IN ('material', 'process', 'service')),
  name TEXT NOT NULL,
  quantity NUMERIC(14,4) NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
  total_cost_cents INTEGER NOT NULL CHECK (total_cost_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_line_item_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_order_line_item_components_line
  ON public.order_line_item_components(order_line_item_id, sort_order);

DROP TRIGGER IF EXISTS trg_order_line_item_components_updated_at
  ON public.order_line_item_components;
CREATE TRIGGER trg_order_line_item_components_updated_at
  BEFORE UPDATE ON public.order_line_item_components
  FOR EACH ROW EXECUTE FUNCTION public.deals_set_updated_at();

ALTER TABLE public.order_line_item_components ENABLE ROW LEVEL SECURITY;

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
