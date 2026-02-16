-- Calculate planned_work for all existing production entries based on process formulas

-- length_x_pieces: Sum of (length/1000 * pieces_used) for all inputs (result in meters)
-- Length comes from inventory_packages table
UPDATE portal_production_entries pe
SET planned_work = (
  SELECT ROUND(CAST(SUM(
    (CAST(NULLIF(ip.length, '') AS NUMERIC) / 1000.0) * COALESCE(pi.pieces_used, 0)
  ) AS NUMERIC), 2)
  FROM portal_production_inputs pi
  JOIN inventory_packages ip ON ip.id = pi.package_id
  WHERE pi.production_entry_id = pe.id
    AND ip.length IS NOT NULL
    AND ip.length != ''
    AND pi.pieces_used > 0
)
FROM ref_processes rp
WHERE pe.process_id = rp.id
  AND rp.work_formula = 'length_x_pieces'
  AND pe.planned_work IS NULL;

-- area: Sum of (length * width * pieces_used / 1000000) for all inputs (result in m²)
UPDATE portal_production_entries pe
SET planned_work = (
  SELECT ROUND(CAST(SUM(
    (CAST(NULLIF(ip.length, '') AS NUMERIC) * CAST(NULLIF(ip.width, '') AS NUMERIC) * COALESCE(pi.pieces_used, 0)) / 1000000.0
  ) AS NUMERIC), 2)
  FROM portal_production_inputs pi
  JOIN inventory_packages ip ON ip.id = pi.package_id
  WHERE pi.production_entry_id = pe.id
    AND ip.length IS NOT NULL
    AND ip.length != ''
    AND ip.width IS NOT NULL
    AND ip.width != ''
    AND pi.pieces_used > 0
)
FROM ref_processes rp
WHERE pe.process_id = rp.id
  AND rp.work_formula = 'area'
  AND pe.planned_work IS NULL;

-- volume: Sum of volume_m3 for all inputs (result in m³)
UPDATE portal_production_entries pe
SET planned_work = (
  SELECT ROUND(CAST(SUM(COALESCE(pi.volume_m3, 0)) AS NUMERIC), 3)
  FROM portal_production_inputs pi
  WHERE pi.production_entry_id = pe.id
)
FROM ref_processes rp
WHERE pe.process_id = rp.id
  AND rp.work_formula = 'volume'
  AND pe.planned_work IS NULL;

-- pieces: Sum of pieces_used for all inputs
UPDATE portal_production_entries pe
SET planned_work = (
  SELECT SUM(COALESCE(pi.pieces_used, 0))
  FROM portal_production_inputs pi
  WHERE pi.production_entry_id = pe.id
)
FROM ref_processes rp
WHERE pe.process_id = rp.id
  AND rp.work_formula = 'pieces'
  AND pe.planned_work IS NULL;

-- output_packages: Count of output packages
UPDATE portal_production_entries pe
SET planned_work = (
  SELECT COUNT(*)
  FROM portal_production_outputs po
  WHERE po.production_entry_id = pe.id
)
FROM ref_processes rp
WHERE pe.process_id = rp.id
  AND rp.work_formula = 'output_packages'
  AND pe.planned_work IS NULL;
