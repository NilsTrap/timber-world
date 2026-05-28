-- Fix order code generation.
--
-- Previously createOrder() called a non-existent nextval(seq_name) RPC and, on
-- its failure, fell back to "ORD-" || (count of orders + 1). That count runs
-- under the caller's RLS, so org users (who can only see their own org's orders)
-- produced a number lower than the true total and generated an already-existing
-- code, violating the orders_code_key unique constraint -> "Failed to create order".
--
-- Generate the code in the database via a sequence-backed DEFAULT instead, so it
-- is atomic and independent of who is inserting. The app no longer supplies code.

-- Inserting roles must be able to read/advance the sequence for the DEFAULT to fire.
GRANT USAGE, SELECT ON SEQUENCE order_number_seq TO authenticated, service_role;

-- The sequence had drifted behind the data. Advance it past the highest existing
-- ORD-#### number so the next generated code is guaranteed free.
SELECT setval(
  'order_number_seq',
  GREATEST(
    (SELECT COALESCE(MAX((substring(code from '^ORD-(\d+)$'))::int), 0) FROM orders),
    1
  ),
  true
);

-- Generate code atomically in the DB.
ALTER TABLE orders
  ALTER COLUMN code SET DEFAULT 'ORD-' || lpad(nextval('order_number_seq')::text, 3, '0');
