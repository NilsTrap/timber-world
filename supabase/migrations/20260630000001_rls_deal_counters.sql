-- Enable RLS on public.deal_counters — closes Security Advisor "RLS Disabled in Public".
--
-- Background: deal_counters was created in 20260615000001_deals_mvp.sql, which enabled
-- RLS on deals/deal_line_items/deal_external_refs/deal_documents but NOT on the counter
-- table. The deals* tables were later dropped (20260616000003), yet deal_counters was
-- deliberately kept (it powers orders deal-code & document numbering), carrying the gap
-- forward on both prod and staging. With RLS off and the default anon/authenticated
-- grants, the public anon key could SELECT/UPDATE/DELETE/TRUNCATE the counters directly
-- via PostgREST, corrupting deal/invoice numbering.
--
-- The counter is only ever reached through next_counter(scope), a SECURITY DEFINER
-- function owned by `postgres` (rolbypassrls), called via RPC from
-- apps/portal/src/features/orders/services/numbering.ts. Nothing reads or writes the
-- table directly. Enabling RLS with NO policies therefore denies all anon/authenticated
-- direct access while leaving counter allocation fully functional.
--
-- Idempotent: re-running ENABLE ROW LEVEL SECURITY on an already-RLS table is a no-op.
-- Rollback: ALTER TABLE public.deal_counters DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.deal_counters ENABLE ROW LEVEL SECURITY;
