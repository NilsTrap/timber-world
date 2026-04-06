-- Re-fix dimensions for all ordered packages with a staircase_code_id.
-- Pulls correct thickness, width, riser, and volume from uk_staircase_pricing.
-- Previous fix (migration 28) may have been overwritten by auto-save in the UI.

UPDATE inventory_packages ip
SET
  thickness = usp.thickness_mm::text,
  width = usp.width_mm::text,
  riser = COALESCE(usp.riser_mm::text, ''),
  volume_m3 = (
    usp.thickness_mm *
    (usp.width_mm + COALESCE(usp.riser_mm, 0)) *
    usp.length_mm
  )::numeric / 1000000000.0
FROM uk_staircase_pricing usp
WHERE ip.staircase_code_id = usp.id
  AND ip.status = 'ordered'
  AND ip.staircase_code_id IS NOT NULL;
