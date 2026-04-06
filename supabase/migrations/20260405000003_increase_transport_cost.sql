-- Add 11 EUR (1100 cents) to all transport costs
UPDATE uk_staircase_pricing
SET transport_cost_cents = transport_cost_cents + 1100;
