-- Populate the approved P04687/S04724 prototype with the structured values
-- represented by the source spreadsheet. This is conditional and becomes a
-- no-op in environments where the sample project is absent.
WITH sample_lines AS (
  SELECT l.id
  FROM public.order_line_items l
  JOIN public.orders o ON o.id=l.order_id
  JOIN public.catalog_products p ON p.id=l.catalog_product_id
  WHERE o.name='P04687 S04724' AND p.name='Metal sheets'
)
UPDATE public.order_line_items l
SET specification_fields=jsonb_build_array(
  jsonb_build_object('key','net_weight','label','Net weight','value','7233.56 kg'),
  jsonb_build_object('key','gross_weight','label','Gross weight','value','8749 kg'),
  jsonb_build_object('key','part_count','label','Part count','value','381 pcs'),
  jsonb_build_object('key','total_surface_area','label','Total surface area','value','178.33 m²'),
  jsonb_build_object('key','visible_surface_area','label','Visible surface area','value','0 m²'),
  jsonb_build_object('key','hidden_surface_area','label','Hidden surface area','value','0 m²'),
  jsonb_build_object('key','colour_code','label','Colour code','value','Not painted')
)
FROM sample_lines s WHERE l.id=s.id AND l.specification_fields='[]'::jsonb;

WITH sample_lines AS (
  SELECT l.id
  FROM public.order_line_items l
  JOIN public.orders o ON o.id=l.order_id
  JOIN public.catalog_products p ON p.id=l.catalog_product_id
  WHERE o.name='P04687 S04724' AND p.name='Metal sheets'
), requirements(field_key,name,value,unit,sort_order) AS (VALUES
  ('metal','Metal','8749','kg',10),
  ('cutting','Cutting','974.31','m',20),
  ('bending','Bending','2309.51','m',30),
  ('straightening','Straightening','0','m',40),
  ('countersinking','Countersinking','439.39','m',50),
  ('rolling','Rolling','0','m',60),
  ('welding','Welding','0','m',70),
  ('galvanizing','Galvanizing','0','kg',80),
  ('painting','Painting','0','m²',90),
  ('shot_blasting','Shot blasting','0','m²',100),
  ('powder_priming','Powder priming','0','m²',110),
  ('powder_coating','Powder coating','0','m²',120),
  ('wet_priming','Wet priming','0','m²',130),
  ('wet_painting','Wet painting','0','m²',140),
  ('packaging','Packaging','1','pcs',150),
  ('transport','Transport','0','km',160)
)
INSERT INTO public.order_line_item_process_requirements(order_line_item_id,field_key,name,value,unit,sort_order)
SELECT l.id,r.field_key,r.name,r.value,r.unit,r.sort_order
FROM sample_lines l CROSS JOIN requirements r
ON CONFLICT(order_line_item_id,field_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
