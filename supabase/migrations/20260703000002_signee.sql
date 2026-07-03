-- G3 (§8.2 signature blocks) · Signee = the named person who signs a document.
--
-- Two levels, mirroring the deal-terms model:
--   organisations.default_signee_*  — the party's usual signatory (address book)
--   orders.{seller,buyer}_signee_*  — a per-deal override, defaulted from the org
-- assemble resolves: deal override → org default → null. Additive + idempotent.

ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS default_signee_name TEXT;
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS default_signee_role TEXT;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_signee_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_signee_role TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_signee_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_signee_role TEXT;
