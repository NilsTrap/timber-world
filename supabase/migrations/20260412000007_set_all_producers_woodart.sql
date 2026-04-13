-- Set producer to Wood Art for ALL orders (including ones that already have a different producer)
UPDATE orders
SET producer_organisation_id = (
  SELECT id FROM organisations WHERE name ILIKE '%wood%art%' LIMIT 1
);
