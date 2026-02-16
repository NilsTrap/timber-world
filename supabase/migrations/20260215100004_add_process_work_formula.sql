-- Add work formula column to ref_processes
-- Stores the formula type used to calculate planned work amount

ALTER TABLE ref_processes
ADD COLUMN work_formula TEXT;

-- Formula types:
-- 'length_x_pieces' = Sum of (length × pieces) for all inputs - measured in meters
-- 'area' = Sum of (length × width × pieces) for all inputs - measured in m²
-- 'volume' = Sum of volume_m3) for all inputs - measured in m³
-- 'pieces' = Sum of pieces for all inputs - measured in pkg
-- 'hours' = Manual entry only - measured in h
-- NULL = No auto-calculation

COMMENT ON COLUMN ref_processes.work_formula IS 'Formula type for calculating planned work: length_x_pieces, area, volume, pieces, hours, or NULL for manual';

-- Set calibration to use length_x_pieces formula
UPDATE ref_processes
SET work_formula = 'length_x_pieces', updated_at = NOW()
WHERE value ILIKE '%calibration%';
