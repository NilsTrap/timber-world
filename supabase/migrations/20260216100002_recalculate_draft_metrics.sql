-- Recalculate totals for all draft production entries
-- This ensures existing drafts show correct values in the Drafts table

-- Update total_input_m3 for all drafts
UPDATE portal_production_entries pe
SET total_input_m3 = COALESCE((
  SELECT SUM(pi.volume_m3)
  FROM portal_production_inputs pi
  WHERE pi.production_entry_id = pe.id
), 0)
WHERE pe.status = 'draft';

-- Update total_output_m3 for all drafts
UPDATE portal_production_entries pe
SET total_output_m3 = COALESCE((
  SELECT SUM(po.volume_m3)
  FROM portal_production_outputs po
  WHERE po.production_entry_id = pe.id
), 0)
WHERE pe.status = 'draft';

-- Update outcome_percentage and waste_percentage for all drafts
UPDATE portal_production_entries
SET
  outcome_percentage = CASE
    WHEN total_input_m3 > 0 THEN ROUND((total_output_m3 / total_input_m3) * 100, 2)
    ELSE 0
  END,
  waste_percentage = CASE
    WHEN total_input_m3 > 0 THEN ROUND(100 - (total_output_m3 / total_input_m3) * 100, 2)
    ELSE 0
  END
WHERE status = 'draft';

-- Also update planned_work for drafts that are missing it
-- length_x_pieces formula
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
  AND pe.status = 'draft'
  AND pe.planned_work IS NULL;

-- area formula
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
  AND pe.status = 'draft'
  AND pe.planned_work IS NULL;

-- volume formula
UPDATE portal_production_entries pe
SET planned_work = (
  SELECT ROUND(CAST(SUM(COALESCE(pi.volume_m3, 0)) AS NUMERIC), 3)
  FROM portal_production_inputs pi
  WHERE pi.production_entry_id = pe.id
)
FROM ref_processes rp
WHERE pe.process_id = rp.id
  AND rp.work_formula = 'volume'
  AND pe.status = 'draft'
  AND pe.planned_work IS NULL;

-- pieces formula
UPDATE portal_production_entries pe
SET planned_work = (
  SELECT SUM(COALESCE(pi.pieces_used, 0))
  FROM portal_production_inputs pi
  WHERE pi.production_entry_id = pe.id
)
FROM ref_processes rp
WHERE pe.process_id = rp.id
  AND rp.work_formula = 'pieces'
  AND pe.status = 'draft'
  AND pe.planned_work IS NULL;

-- output_packages formula
UPDATE portal_production_entries pe
SET planned_work = (
  SELECT COUNT(*)
  FROM portal_production_outputs po
  WHERE po.production_entry_id = pe.id
)
FROM ref_processes rp
WHERE pe.process_id = rp.id
  AND rp.work_formula = 'output_packages'
  AND pe.status = 'draft'
  AND pe.planned_work IS NULL;
