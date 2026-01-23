-- Add transport cost (EUR) to shipments
ALTER TABLE shipments
  ADD COLUMN transport_cost_eur NUMERIC(10, 2);
