-- Fill missing volume_m3 for packages that have thickness, width, length dimensions
-- Formula: thickness_mm × (width_mm + riser_mm) × length_mm / 1,000,000,000

UPDATE inventory_packages
SET volume_m3 = (
  CAST(thickness AS numeric) *
  (CAST(width AS numeric) + COALESCE(CAST(NULLIF(riser, '') AS numeric), 0)) *
  CAST(length AS numeric)
) / 1000000000.0
WHERE volume_m3 IS NULL
  AND thickness IS NOT NULL AND thickness != ''
  AND width IS NOT NULL AND width != ''
  AND length IS NOT NULL AND length != '';
