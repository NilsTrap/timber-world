-- Fix transport_per_piece to use stored value from uk_staircase_pricing
-- instead of the calculated volume × 300 + 11 formula
UPDATE inventory_packages ip
SET transport_per_piece = usp.transport_cost_cents / 100.0
FROM uk_staircase_pricing usp
WHERE ip.staircase_code_id = usp.id
  AND ip.staircase_code_id IS NOT NULL
  AND usp.transport_cost_cents IS NOT NULL;
