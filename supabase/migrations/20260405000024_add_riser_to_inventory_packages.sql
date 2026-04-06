-- Add riser column to inventory_packages for staircase riser dimension
ALTER TABLE inventory_packages ADD COLUMN riser TEXT;

-- Populate riser from staircase code for all existing packages that have a staircase_code_id
UPDATE inventory_packages ip
SET riser = CASE WHEN usp.riser_mm IS NOT NULL AND usp.riser_mm > 0 THEN usp.riser_mm::text ELSE NULL END
FROM uk_staircase_pricing usp
WHERE ip.staircase_code_id = usp.id
  AND ip.staircase_code_id IS NOT NULL;

-- Recalculate volume_m3 to include riser: thickness × (width + riser) × length / 1e9
UPDATE inventory_packages
SET volume_m3 = (
  CAST(thickness AS numeric) *
  (CAST(width AS numeric) + COALESCE(CAST(riser AS numeric), 0)) *
  CAST(length AS numeric)
) / 1000000000.0
WHERE staircase_code_id IS NOT NULL
  AND thickness IS NOT NULL
  AND width IS NOT NULL
  AND length IS NOT NULL;
