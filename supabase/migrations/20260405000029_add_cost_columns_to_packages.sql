-- Add editable cost columns to inventory_packages so they persist across sessions
ALTER TABLE inventory_packages
  ADD COLUMN IF NOT EXISTS work_per_piece numeric,
  ADD COLUMN IF NOT EXISTS transport_per_piece numeric,
  ADD COLUMN IF NOT EXISTS eur_per_m3 numeric;

-- Seed existing staircase packages with values from uk_staircase_pricing
UPDATE inventory_packages ip
SET
  work_per_piece = usp.work_cost_cents / 100.0,
  eur_per_m3 = usp.eur_per_m3_cents / 100.0,
  transport_per_piece = ROUND((ip.volume_m3 * 300 + 11)::numeric, 2)
FROM uk_staircase_pricing usp
WHERE ip.staircase_code_id = usp.id
  AND ip.staircase_code_id IS NOT NULL
  AND ip.volume_m3 IS NOT NULL;
