-- =============================================
-- Migration: Add work_unit column to ref_processes
-- Stores the unit of measurement for work done in each process
-- (e.g., meters, m², m³, packages, hours)
-- =============================================

-- Add work_unit column
ALTER TABLE ref_processes ADD COLUMN work_unit TEXT;

-- Populate initial values based on process names
UPDATE ref_processes SET work_unit = CASE
  WHEN value ILIKE '%calibration%' THEN 'm'
  WHEN value ILIKE '%cross-cut%' OR value ILIKE '%crosscut%' THEN 'm'
  WHEN value ILIKE '%filling%' THEN 'm²'
  WHEN value ILIKE '%finger joint%' OR value ILIKE '%fingerjoint%' THEN 'm'
  WHEN value ILIKE '%gluing%' OR value ILIKE '%glue%' THEN 'm³'
  WHEN value ILIKE '%kiln%' OR value ILIKE '%drying%' THEN 'm³'
  WHEN value ILIKE '%multi-saw%' OR value ILIKE '%multisaw%' OR value ILIKE '%multi saw%' THEN 'm'
  WHEN value ILIKE '%optimization%' OR value ILIKE '%optimiz%' THEN 'm'
  WHEN value ILIKE '%pack%' THEN 'pkg'
  WHEN value ILIKE '%planing%' OR value ILIKE '%planer%' THEN 'm'
  WHEN value ILIKE '%sand%' THEN 'm²'
  WHEN value ILIKE '%sort%' THEN 'h'
  WHEN value ILIKE '%saw%' THEN 'm'
  ELSE NULL
END;

COMMENT ON COLUMN ref_processes.work_unit IS 'Unit of measurement for work done (m, m², m³, pkg, h)';
