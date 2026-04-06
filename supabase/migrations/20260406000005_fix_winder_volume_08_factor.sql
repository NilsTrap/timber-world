-- Fix winder volumes: winders use 0.8 multiplier (irregular shape)
-- Raw volume = thickness × width × length / 1e9
-- Winder volume = raw volume × 0.8

UPDATE inventory_packages ip
SET volume_m3 = (
  usp.thickness_mm *
  (usp.width_mm + COALESCE(usp.riser_mm, 0)) *
  usp.length_mm
)::numeric / 1000000000.0 * 0.8
FROM uk_staircase_pricing usp
WHERE ip.staircase_code_id = usp.id
  AND ip.staircase_code_id IS NOT NULL
  AND ip.status = 'ordered'
  AND usp.name = 'Winder';
