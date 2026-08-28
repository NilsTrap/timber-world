-- Catalogue process fields and immutable, price-free project snapshots.

ALTER TABLE public.catalog_category_field_assignments
  DROP CONSTRAINT IF EXISTS catalog_category_field_assignments_applies_to_check;
ALTER TABLE public.catalog_category_field_assignments
  ADD CONSTRAINT catalog_category_field_assignments_applies_to_check
  CHECK (applies_to IN ('product', 'variant', 'process'));

INSERT INTO public.catalog_fields (field_key, field_label, field_type, unit)
VALUES
  ('sheets', 'Sheets', 'number', NULL),
  ('metal', 'Metal', 'number', NULL),
  ('cutting', 'Cutting', 'number', NULL),
  ('bending', 'Bending', 'number', NULL),
  ('straightening', 'Straightening', 'number', NULL),
  ('countersinking', 'Countersinking', 'number', NULL),
  ('rolling', 'Rolling', 'number', NULL),
  ('welding', 'Welding', 'number', NULL),
  ('galvanizing', 'Galvanizing', 'number', NULL),
  ('tubes', 'Tubes', 'number', NULL),
  ('painting', 'Painting', 'number', NULL),
  ('shot_blasting', 'Shot blasting', 'number', NULL),
  ('powder_priming', 'Powder priming', 'number', NULL),
  ('powder_coating', 'Powder coating', 'number', NULL),
  ('wet_priming', 'Wet priming', 'number', NULL),
  ('wet_painting', 'Wet painting', 'number', NULL),
  ('packaging', 'Packaging', 'number', NULL),
  ('transport', 'Transport', 'number', NULL)
ON CONFLICT (field_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.order_line_item_process_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_item_id UUID NOT NULL REFERENCES public.order_line_items(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_line_item_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_order_line_item_process_requirements_line
  ON public.order_line_item_process_requirements(order_line_item_id, sort_order);

ALTER TABLE public.order_line_item_process_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_line_item_process_requirements_select
ON public.order_line_item_process_requirements FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.order_line_items line
  JOIN public.orders deal ON deal.id = line.order_id
  WHERE line.id = order_line_item_id AND (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(deal.buyer_organisation_id)
    OR public.current_user_in_org(deal.seller_organisation_id)
    OR EXISTS (
      SELECT 1 FROM public.order_line_items downstream
      JOIN public.orders downstream_deal ON downstream_deal.id = downstream.order_id
      WHERE downstream.origin_line_item_id = line.id
        AND (public.current_user_in_org(downstream_deal.buyer_organisation_id)
          OR public.current_user_in_org(downstream_deal.seller_organisation_id))
    )
  )
));

-- Snapshots are append-only. Updates and direct deletes are deliberately not
-- granted; deleting the parent line still removes its snapshots via the FK.
CREATE POLICY order_line_item_process_requirements_insert
ON public.order_line_item_process_requirements FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.order_line_items line
  JOIN public.orders deal ON deal.id = line.order_id
  WHERE line.id = order_line_item_id AND (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(deal.seller_organisation_id)
  )
));
