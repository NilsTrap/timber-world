-- Import production data from "Stair production B55 - Data import.pdf"
-- Updates production fields for existing orders matched by PO number (name) + project_number

-- P04171 / S03243
UPDATE orders SET
  planned_date = '2026-04-03', tread_m3 = 0.110, winder_m3 = 0.062, quarter_m3 = 0,
  used_material_m3 = 0.263, production_material = 0, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 0
WHERE name = 'P04171' AND project_number = 'S03243';

-- P04150 / S04078
UPDATE orders SET
  planned_date = '2026-04-03', tread_m3 = 0.069, winder_m3 = 0.032, quarter_m3 = 0.031,
  used_material_m3 = 0.180, production_material = 0, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 0
WHERE name = 'P04150' AND project_number = 'S04078';

-- P04149 / S04259
UPDATE orders SET
  planned_date = '2026-04-03', tread_m3 = 0.083, winder_m3 = 0.036, quarter_m3 = 0,
  used_material_m3 = 0.157, production_material = 0, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 0
WHERE name = 'P04149' AND project_number = 'S04259';

-- P04182 / S04582 v2
UPDATE orders SET
  planned_date = '2026-04-03', tread_m3 = 0.340, winder_m3 = 0, quarter_m3 = 0,
  used_material_m3 = 0.389, production_material = 0, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 0
WHERE name = 'P04182' AND project_number = 'S04582 v2';

-- P04182 / S04582 v3
UPDATE orders SET
  planned_date = '2026-04-03', tread_m3 = 0.236, winder_m3 = 0.1221, quarter_m3 = 0,
  used_material_m3 = 0.461, production_material = 0, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 0
WHERE name = 'P04182' AND project_number = 'S04582 v3';

-- P00652 / 0V00395
UPDATE orders SET
  planned_date = '2026-04-03', tread_m3 = 0.261, winder_m3 = 0.1155, quarter_m3 = 0,
  used_material_m3 = 0.486, production_material = 0, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 0
WHERE name = 'P00652' AND project_number = '0V00395';

-- P00649 / 0V01478
UPDATE orders SET
  planned_date = '2026-04-03', tread_m3 = 0.256, winder_m3 = 0.1133, quarter_m3 = 0,
  used_material_m3 = 0.447, production_material = 0, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 0
WHERE name = 'P00649' AND project_number = '0V01478';

-- P04096 / S04163 (4 rows in DB, same production data for all)
UPDATE orders SET
  planned_date = '2026-04-03', tread_m3 = 1.010, winder_m3 = 0, quarter_m3 = 0.154,
  used_material_m3 = 2.025, production_material = 1090.50, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 0
WHERE name = 'P04096' AND project_number = 'S04163';

-- P04155 / S04572
UPDATE orders SET
  planned_date = '2026-03-27', tread_m3 = 0.359, winder_m3 = 0.2596, quarter_m3 = 0,
  used_material_m3 = 0.848, production_material = 800.50, production_finishing = 0,
  wood_art = 176, wood_art_cnc = 715.23
WHERE name = 'P04155' AND project_number = 'S04572';

-- P04105 / S04333 - GUSTAVO (DB has "S04333 - GUSTAVO")
UPDATE orders SET
  planned_date = '2026-03-20', tread_m3 = 0.288, winder_m3 = 0, quarter_m3 = 0,
  used_material_m3 = 0.334, production_material = 431.00, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 101.28
WHERE name = 'P04105' AND project_number = 'S04333 - GUSTAVO';

-- P04107 / S04549
UPDATE orders SET
  planned_date = '2026-03-27', tread_m3 = 0.131, winder_m3 = 0, quarter_m3 = 0.078,
  used_material_m3 = 0.287, production_material = 345.50, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 0
WHERE name = 'P04107' AND project_number = 'S04549';

-- P00639 / 0V01262
UPDATE orders SET
  planned_date = '2026-03-20', tread_m3 = 0.175, winder_m3 = 0.152922, quarter_m3 = 0,
  used_material_m3 = 0.417, production_material = 436.00, production_finishing = 0,
  wood_art = 0, wood_art_cnc = 132.93
WHERE name = 'P00639' AND project_number = '0V01262';

-- P04075 / S03674
UPDATE orders SET
  planned_date = '2026-03-13', tread_m3 = 0.271, winder_m3 = 0, quarter_m3 = 0,
  used_material_m3 = 0.386, production_material = 30.00, production_finishing = 197.28,
  wood_art = 0, wood_art_cnc = 247.83
WHERE name = 'P04075' AND project_number = 'S03674';

-- P00631 / 0V01953
UPDATE orders SET
  planned_date = '2026-03-09', tread_m3 = 0.224, winder_m3 = 0.12551, quarter_m3 = 0,
  used_material_m3 = 0.456, production_material = 265.79, production_finishing = 205.71,
  wood_art = 96.07, wood_art_cnc = 185.64
WHERE name = 'P00631' AND project_number = '0V01953';

-- P04058 / S03662
UPDATE orders SET
  planned_date = '2026-03-13', tread_m3 = 0, winder_m3 = 0.565, quarter_m3 = 0,
  used_material_m3 = 0.726, production_material = 763.00, production_finishing = 306.30,
  wood_art = 0, wood_art_cnc = 398.83
WHERE name = 'P04058' AND project_number = 'S03662';

-- P00629 / 0V01941
UPDATE orders SET
  planned_date = '2026-03-09', tread_m3 = 0.318, winder_m3 = 0, quarter_m3 = 0,
  used_material_m3 = 0.475, production_material = 326.43, production_finishing = 217.39,
  wood_art = 0, wood_art_cnc = 75.96
WHERE name = 'P00629' AND project_number = '0V01941';

-- P04054 / S03856
UPDATE orders SET
  planned_date = '2026-03-09', tread_m3 = 0.360, winder_m3 = 0, quarter_m3 = 0.116,
  used_material_m3 = 0.643, production_material = 627.92, production_finishing = 262.23,
  wood_art = 0, wood_art_cnc = 109.79
WHERE name = 'P04054' AND project_number = 'S03856';

-- P00621 / 0V01327
UPDATE orders SET
  planned_date = '2026-03-09', tread_m3 = 0, winder_m3 = 0.157, quarter_m3 = 0,
  used_material_m3 = 0.194, production_material = 91.50, production_finishing = 99.70,
  wood_art = 0, wood_art_cnc = 88.62
WHERE name = 'P00621' AND project_number = '0V01327';

-- P04036 / S02905
UPDATE orders SET
  planned_date = '2026-03-09', tread_m3 = 0.165, winder_m3 = 0, quarter_m3 = 0.030,
  used_material_m3 = 0.244, production_material = 72.00, production_finishing = 142.36,
  wood_art = 0, wood_art_cnc = 6.33
WHERE name = 'P04036' AND project_number = 'S02905';
