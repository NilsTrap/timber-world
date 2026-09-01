-- Price metal as a production requirement instead of a duplicate line-level quote.
UPDATE public.catalog_fields
SET field_label='Material',unit='kg',updated_at=now()
WHERE field_key='metal';

INSERT INTO public.catalog_category_field_assignments(
  category_id,field_id,applies_to,show_in_filter,show_in_detail,show_in_price_list,is_required,sort_order
)
SELECT category.id,field.id,'process',false,true,false,false,10
FROM public.catalog_categories category
JOIN public.catalog_fields field ON field.field_key='metal'
WHERE category.name='Metal stairs'
ON CONFLICT(category_id,field_id) DO UPDATE SET
  applies_to='process',show_in_detail=true,is_required=false,sort_order=10;

-- A zero default keeps Material visible on new category lines until its real
-- purchased weight is entered in the specification.
INSERT INTO public.catalog_product_field_values(product_id,field_id,value_number)
SELECT product.id,field.id,0
FROM public.catalog_products product
JOIN public.catalog_categories category ON category.id=product.category_id AND category.name='Metal stairs'
JOIN public.catalog_fields field ON field.field_key='metal'
ON CONFLICT(product_id,field_id) DO NOTHING;

-- Existing catalogue snapshots inherit Material from their gross-weight
-- property (falling back to their line quantity when gross weight is absent).
INSERT INTO public.order_line_item_process_requirements(
  order_line_item_id,field_key,name,value,unit,sort_order,is_active
)
SELECT line.id,'metal','Material',coalesce(
  nullif(trim(property.item->>'value'),''),
  public.project_origin_required_quantity(line.volume_m3,line.pieces)::text,
  '0'
),'kg',10,true
FROM public.order_line_items line
JOIN public.catalog_products product ON product.id=line.catalog_product_id
JOIN public.catalog_categories category ON category.id=product.category_id AND category.name='Metal stairs'
LEFT JOIN LATERAL(
  SELECT item FROM jsonb_array_elements(line.specification_fields) item
  WHERE item->>'key'='gross_weight' LIMIT 1
) property ON true
WHERE line.origin_line_item_id IS NULL
ON CONFLICT(order_line_item_id,field_key) DO NOTHING;
