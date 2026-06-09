-- Company-role flags on organisations: a company can have ANY combination of
-- Customer / Manufacturer / Producer (multi-role — e.g. a customer can also be
-- a producer). Set in the org-details UI.
--
-- SCOPE: for now these flags are consumed ONLY by the Orders "Add Order" flow
-- (to decide which party slot the creating user's org fills, and which
-- counterparty they pick from their trading partners). They are NOT wired into
-- RLS, permissions, shipments, inventory, production, or anything else.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS is_customer     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_manufacturer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_producer     boolean NOT NULL DEFAULT false;

-- ── Backfill from existing order history, INTERNAL companies only ──────────
-- (roles are meaningful for internal orgs; external orgs are trading partners
-- and are intentionally left with no roles).
UPDATE public.organisations o SET is_manufacturer = true
WHERE o.is_external = false
  AND EXISTS (SELECT 1 FROM public.orders ord WHERE ord.seller_organisation_id = o.id);

UPDATE public.organisations o SET is_customer = true
WHERE o.is_external = false
  AND EXISTS (SELECT 1 FROM public.orders ord WHERE ord.customer_organisation_id = o.id);

UPDATE public.organisations o SET is_producer = true
WHERE o.is_external = false
  AND EXISTS (SELECT 1 FROM public.orders ord WHERE ord.producer_organisation_id = o.id);

-- ── Manual role assignments (requested) ───────────────────────────────────
--  - Timber International (TIM): second Manufacturer (no seller history yet).
--  - Inerce (INE), B55, Mārtiņš (MAR): also Producers.
UPDATE public.organisations SET is_manufacturer = true WHERE code = 'TIM';
UPDATE public.organisations SET is_producer = true WHERE code IN ('INE', 'B55', 'MAR');

COMMENT ON COLUMN public.organisations.is_customer IS 'Company can act as the Customer (buyer) on orders. Multi-role; Orders-only for now.';
COMMENT ON COLUMN public.organisations.is_manufacturer IS 'Company can act as the Manufacturer (seller) on orders. Multi-role; Orders-only for now.';
COMMENT ON COLUMN public.organisations.is_producer IS 'Company can act as the Producer (workshop) on orders. Multi-role; Orders-only for now.';
