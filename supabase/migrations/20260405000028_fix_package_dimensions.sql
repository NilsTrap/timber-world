-- Fix dimensions for packages 11-47 inserted by migration 25
-- Correct thickness, width, riser based on actual uk_staircase_pricing values

-- Update all packages to match their staircase code dimensions
UPDATE inventory_packages ip
SET
  thickness = usp.thickness_mm::text,
  width = usp.width_mm::text,
  riser = COALESCE(usp.riser_mm::text, ''),
  -- Recalculate volume: thickness × (width + riser) × length / 1e9
  volume_m3 = (
    usp.thickness_mm *
    (usp.width_mm + COALESCE(usp.riser_mm, 0)) *
    usp.length_mm
  )::numeric / 1000000000.0
FROM uk_staircase_pricing usp
WHERE ip.staircase_code_id = usp.id
  AND ip.package_number IN (
    '11','12','13','14','15','16','17','18','19','20',
    '21','22','23','24','25','26','27','28','29','30',
    '31','32','33','34','35','36','37','38','39','40',
    '41','42','43','44','45','46','47'
  )
  AND ip.organisation_id = '2ef9e211-aadc-49b5-a450-4b5a9b1dd614';
