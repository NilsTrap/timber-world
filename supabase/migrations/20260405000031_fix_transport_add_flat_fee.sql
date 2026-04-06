-- Fix transport_per_piece: transport_cost_cents is the BASE cost,
-- full transport = base + 11 EUR flat fee
UPDATE inventory_packages ip
SET transport_per_piece = usp.transport_cost_cents / 100.0 + 11
FROM uk_staircase_pricing usp
WHERE ip.staircase_code_id = usp.id
  AND ip.staircase_code_id IS NOT NULL
  AND usp.transport_cost_cents IS NOT NULL;
