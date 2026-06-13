-- Tighten quote_requests RLS.
--
-- Previously (20260210100002) quote_requests had:
--   "Allow authenticated read"   FOR SELECT TO authenticated USING (true)
--   "Allow authenticated update" FOR UPDATE TO authenticated USING (true) WITH CHECK (true)
-- i.e. ANY logged-in portal user could read and modify every inbound marketing
-- quote lead (customer PII), regardless of org or module. That is a data leak.
--
-- The portal's Quote Requests feature now performs its reads/updates through the
-- service-role admin client AFTER an explicit permission check in the server
-- action (quotes.view two-layer, admin bypass) — the same "verify in TypeScript,
-- then service-role for the intentional bypass" pattern used for shipments/CRM.
-- service_role bypasses RLS, so dropping the blanket authenticated policies does
-- not break the portal.
--
-- "Allow public insert" is intentionally kept so the public marketing website can
-- still submit quote requests (anon + authenticated INSERT).

DROP POLICY IF EXISTS "Allow authenticated read" ON quote_requests;
DROP POLICY IF EXISTS "Allow authenticated update" ON quote_requests;

-- (No replacement SELECT/UPDATE policy: only service_role may read/update, via the
--  admin client inside an authorized server action.)
