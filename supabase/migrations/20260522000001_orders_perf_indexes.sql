-- Performance indexes for order list queries.
--
-- Two categories of missing index identified during the May 2026
-- performance review:
--
-- 1. The org-scoped order list query in
--    apps/portal/src/features/orders/actions/getOrders.ts filters by
--    `status` AND (org-id matches as customer/seller/producer). Status +
--    org-id is the most common combo for org users (their dashboard, their
--    pricing tab, etc.). Without a composite the planner falls back to
--    two separate index probes.
--
-- 2. The same query uses an OR across the three party columns. PG can't
--    efficiently use a single index on three columns for an OR. The
--    practical mitigation is to ensure each of the three party columns
--    has its own index AND a composite that pairs each with `status`.
--    Individual indexes were already in place (audited); these composites
--    fill the gap.
--
-- Note: not using CREATE INDEX CONCURRENTLY because Supabase wraps each
-- migration in a transaction and CONCURRENTLY is incompatible with that.
-- Orders table is small enough that the brief ACCESS EXCLUSIVE lock on
-- CREATE INDEX is acceptable.

CREATE INDEX IF NOT EXISTS idx_orders_customer_org_status
  ON orders (customer_organisation_id, status)
  WHERE customer_organisation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_seller_org_status
  ON orders (seller_organisation_id, status)
  WHERE seller_organisation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_producer_org_status
  ON orders (producer_organisation_id, status)
  WHERE producer_organisation_id IS NOT NULL;
