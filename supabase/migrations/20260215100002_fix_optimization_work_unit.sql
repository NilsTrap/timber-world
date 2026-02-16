-- Fix optimization work_unit to 'm' (meters)
UPDATE ref_processes
SET work_unit = 'm', updated_at = NOW()
WHERE value ILIKE '%optimization%';
