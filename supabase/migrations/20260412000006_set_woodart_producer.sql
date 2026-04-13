-- Set producer to Wood Art for all orders that don't have a producer yet
UPDATE orders
SET producer_organisation_id = (
  SELECT id FROM organisations WHERE name ILIKE '%wood%art%' LIMIT 1
)
WHERE producer_organisation_id IS NULL;
