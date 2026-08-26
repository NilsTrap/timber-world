-- Explicit development sample from the Mills workbook tab "P04668 S04739".
-- Run intentionally against a development database after schema migrations.

DO $$
DECLARE
  v_seller_id UUID;
  v_buyer_id UUID;
  v_spine_id UUID;
  v_order_id UUID;
  v_line_id UUID;
BEGIN
  SELECT id INTO v_seller_id FROM public.organisations
  WHERE code = 'TIM' AND is_active LIMIT 1;
  SELECT id INTO v_buyer_id FROM public.organisations
  WHERE code = 'KOI' AND is_active AND is_customer LIMIT 1;
  IF v_seller_id IS NULL OR v_buyer_id IS NULL THEN
    RAISE NOTICE 'Skipping Mills sample: active TIM seller and KOI customer are required';
    RETURN;
  END IF;

  SELECT id INTO v_spine_id FROM public.spines WHERE code = 'SP-MILLS-04668';
  IF v_spine_id IS NULL THEN
    v_spine_id := 'f0466800-0000-4000-8000-000000000001';
    INSERT INTO public.spines (id, code, title, life_stage, status, product_group, origin)
    VALUES (v_spine_id, 'SP-MILLS-04668', 'Mills sample · Carcass', 'spec', 'draft', 'Metal fabrication', 'root');
  END IF;

  SELECT id INTO v_order_id FROM public.orders WHERE code = 'ORD-MILLS-04668';
  IF v_order_id IS NULL THEN
    v_order_id := 'f0466800-0000-4000-8000-000000000002';
    INSERT INTO public.orders (
      id, code, name, customer_organisation_id, seller_organisation_id,
      buyer_organisation_id, deal_kind, product_group, currency, status,
      lifecycle_stage, deal_code, spine_id, notes
    ) VALUES (
      v_order_id, 'ORD-MILLS-04668', 'Mills sample · Carcass', v_buyer_id,
      v_seller_id, v_buyer_id, 'sale_only', 'Metal fabrication', 'EUR',
      'draft', 'draft', 'P04668-S04739', v_spine_id,
      'Sample imported from Mills pricing sheet P04668 S04739.'
    );
  END IF;

  SELECT id INTO v_line_id FROM public.order_line_items
  WHERE order_id = v_order_id AND side = 'sell' AND line_no = 1;
  IF v_line_id IS NULL THEN
    v_line_id := 'f0466800-0000-4000-8000-000000000003';
    INSERT INTO public.order_line_items (
      id, order_id, side, line_no, product_name, product_type, pieces, unit,
      unit_price_cents, line_total_cents, notes, is_standard
    ) VALUES (
      v_line_id, v_order_id, 'sell', 1, 'Carcass', 'Fabricated metal assembly',
      '1', 'piece', 54000, 54000,
      'Sheet: 207.73 kg net / 353.37 kg gross · Colour: any · Non-visible surface: 5.67 m²', false
    );
  END IF;

  INSERT INTO public.order_line_item_components
    (order_line_item_id, component_type, name, quantity, unit, unit_cost, total_cost_cents, sort_order)
  VALUES
    (v_line_id, 'material', 'Sheet metal', 353.37, 'kg', 0.90, 31803, 10),
    (v_line_id, 'process', 'Cutting', 207.73, 'kg', 0.39, 8101, 20),
    (v_line_id, 'process', 'Wet priming', 5.67, 'm²', 6.00, 3402, 30)
  ON CONFLICT (order_line_item_id, sort_order) DO UPDATE SET
    component_type = EXCLUDED.component_type,
    name = EXCLUDED.name,
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    unit_cost = EXCLUDED.unit_cost,
    total_cost_cents = EXCLUDED.total_cost_cents;
END $$;
