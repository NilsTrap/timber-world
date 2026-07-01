-- E2 · Strictly bilateral deals + chain adjacency.
-- A deal = one seller + one buyer + one spine. Adds the canonical buyer slot
-- (backfilled from customer_organisation_id) and `upstream_deal_id` — the deal
-- that SOURCES this one (its buy-leg on the same spine). Additive & idempotent;
-- customer_organisation_id is kept for back-compat. Direction (sell/buy) is NOT
-- stored — it is derived relative to the viewer's org (see dealDirectionFor).

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_organisation_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS upstream_deal_id      UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_buyer_organisation_id_fkey') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_buyer_organisation_id_fkey
      FOREIGN KEY (buyer_organisation_id) REFERENCES public.organisations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_upstream_deal_id_fkey') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_upstream_deal_id_fkey
      FOREIGN KEY (upstream_deal_id) REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill: existing rows are sell-legs, so the buyer is the current customer.
UPDATE public.orders
  SET buyer_organisation_id = customer_organisation_id
  WHERE buyer_organisation_id IS NULL AND customer_organisation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_buyer_organisation
  ON public.orders(buyer_organisation_id) WHERE buyer_organisation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_upstream_deal
  ON public.orders(upstream_deal_id) WHERE upstream_deal_id IS NOT NULL;
