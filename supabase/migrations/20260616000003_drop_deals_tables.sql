-- Retire the standalone deals MVP (built 2026-06-15, staging-only test rows).
-- The canonical deal model now lives on `orders` + `order_line_items` /
-- `order_external_refs` / `order_documents` (migration 20260616000001), and the
-- service/MCP layer has been re-pointed onto it (E2.4). Drop the deals* tables.
--
-- DELIBERATELY KEPT (load-bearing for orders):
--   • deal_counters + next_counter()      → orders deal/document numbering
--   • deals_set_updated_at()              → reused by the order_line_items trigger
--   • can_access_deal()                   → kept per the integration-phase handoff
--   • the `deal-documents` storage bucket  → reused for order_documents
--
-- Dropping each table CASCADEs its own indexes, RLS policies and triggers; the
-- shared functions above are NOT table-owned, so they survive.

DROP TABLE IF EXISTS public.deal_documents CASCADE;
DROP TABLE IF EXISTS public.deal_external_refs CASCADE;
DROP TABLE IF EXISTS public.deal_line_items CASCADE;
DROP TABLE IF EXISTS public.deals CASCADE;
