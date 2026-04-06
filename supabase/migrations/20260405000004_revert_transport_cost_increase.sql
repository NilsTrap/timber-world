-- Revert the +1100 cents added in migration 20260405000003
-- Transport cost is now calculated by the formula (m³ × 300 + 11 EUR flat)
UPDATE uk_staircase_pricing
SET transport_cost_cents = transport_cost_cents - 1100;
