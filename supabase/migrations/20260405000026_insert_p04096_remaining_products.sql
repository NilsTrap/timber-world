-- Insert remaining products for the 3 other P04096 orders
-- Copying exact same products from first P04096 order (2679f04b)
-- Pattern: 22 treads × £34 (22×280×1500) + 1 quarter × £67 (22×1700×1700)

INSERT INTO inventory_packages (
  package_number, product_name_id, wood_species_id, type_id, quality_id,
  thickness, width, length, pieces, volume_m3, volume_is_calculated,
  status, organisation_id, order_id, staircase_code_id, riser, unit_price_piece
) VALUES

-- Order 086a56d2 (already has tread pkg 10, just needs quarter)
('48', 'e3f3a659-ccfb-4747-803f-f4bd07b8c234', '77dfe687-72d1-41af-971f-f2d4d14116b7', '8e1b7831-9ab6-4e32-9755-6651607b63f9', 'e1239288-27ad-4592-962f-97815fc1f635',
 '22', '1700', '1700', '1', 0.0711, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '086a56d2-19e5-42a8-a941-992457bb463a', '6a0bce84-cf0f-41e5-a30c-be050aa381f3', '200', 67),

-- Order 3d7e31eb (needs both tread + quarter)
('49', '730ba2b9-d83a-4843-b05e-15084fa676f0', '77dfe687-72d1-41af-971f-f2d4d14116b7', '8e1b7831-9ab6-4e32-9755-6651607b63f9', 'e1239288-27ad-4592-962f-97815fc1f635',
 '22', '280', '1500', '22', 0.0158, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '3d7e31eb-e8d7-41fc-9211-4d2ada050120', '5e8d6ec0-a5e6-4a24-9aa2-4c3528ebcc81', '200', 34),
('50', 'e3f3a659-ccfb-4747-803f-f4bd07b8c234', '77dfe687-72d1-41af-971f-f2d4d14116b7', '8e1b7831-9ab6-4e32-9755-6651607b63f9', 'e1239288-27ad-4592-962f-97815fc1f635',
 '22', '1700', '1700', '1', 0.0711, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '3d7e31eb-e8d7-41fc-9211-4d2ada050120', '6a0bce84-cf0f-41e5-a30c-be050aa381f3', '200', 67),

-- Order 64647e43 (needs both tread + quarter)
('51', '730ba2b9-d83a-4843-b05e-15084fa676f0', '77dfe687-72d1-41af-971f-f2d4d14116b7', '8e1b7831-9ab6-4e32-9755-6651607b63f9', 'e1239288-27ad-4592-962f-97815fc1f635',
 '22', '280', '1500', '22', 0.0158, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '64647e43-d594-42d1-bc0e-ea59f970008c', '5e8d6ec0-a5e6-4a24-9aa2-4c3528ebcc81', '200', 34),
('52', 'e3f3a659-ccfb-4747-803f-f4bd07b8c234', '77dfe687-72d1-41af-971f-f2d4d14116b7', '8e1b7831-9ab6-4e32-9755-6651607b63f9', 'e1239288-27ad-4592-962f-97815fc1f635',
 '22', '1700', '1700', '1', 0.0711, false, 'ordered', '2ef9e211-aadc-49b5-a450-4b5a9b1dd614', '64647e43-d594-42d1-bc0e-ea59f970008c', '6a0bce84-cf0f-41e5-a30c-be050aa381f3', '200', 67);
