-- L2 · Traders category (Wave 2 — spine-Lego chain).
--
-- Traders are a THIRD counterparty category (besides Clients and Suppliers):
-- the house's own trading companies (Timber International + The Wood and Good
-- today; more later). A salesperson is bound to their trader org(s) via
-- organisation membership. This flag drives the New-deal "Trader" party slot,
-- the org-detail Roles toggle, and the admin-only CRM Traders book.
--
-- ADDITIVE + idempotent. `is_manufacturer` is intentionally LEFT UNTOUCHED —
-- legacy flows still read it — so the house orgs carry BOTH flags after this.
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS is_trader BOOLEAN NOT NULL DEFAULT false;

-- Seed the two house/trader orgs. These are exactly the two is_manufacturer=true
-- house companies the New-deal picker shows today:
--   TIM · Timber International SIA
--   TWG · The Wood and Good SIA
UPDATE organisations
SET is_trader = true
WHERE id IN (
  '36bd1389-460d-45b2-952d-84e94aa68b75', -- TIM · Timber International SIA
  'c1bed4cb-4cfb-4827-84e0-432929fb59b2'  -- TWG · The Wood and Good SIA
);
