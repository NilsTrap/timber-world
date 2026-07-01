-- E3 · Deal lifecycle — the spec-aligned 5-stage milestone model (spec §6).
-- Draft → Confirmed → Produced → Loaded → Delivered (+ Cancelled), PER DEAL.
--
-- EVOLVE, not rewrite: the legacy `order_status` enum (draft/pending/confirmed/
-- in_progress/shipped/completed/loaded/cancelled) has 14+ call-sites + live data and
-- drives the operational tabs, so we keep it. `lifecycle_stage` is the NEW canonical
-- spec stage that the gate engine advances; the legacy enum is retired later (E8).
-- Additive & idempotent.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT NOT NULL DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_lifecycle_stage_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_lifecycle_stage_check
      CHECK (lifecycle_stage IN ('draft','confirmed','produced','loaded','delivered','cancelled'));
  END IF;
END $$;

-- One-shot backfill: map the legacy status onto the milestone stage, but only on the
-- FIRST run (when every row is still at the freshly-defaulted 'draft'). On replay this
-- is skipped, so it never clobbers stages the engine has since advanced.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE lifecycle_stage <> 'draft') THEN
    UPDATE public.orders SET lifecycle_stage = CASE status
      WHEN 'draft'       THEN 'draft'
      WHEN 'pending'     THEN 'draft'
      WHEN 'confirmed'   THEN 'confirmed'
      WHEN 'in_progress' THEN 'confirmed'
      WHEN 'shipped'     THEN 'loaded'
      WHEN 'loaded'      THEN 'loaded'
      WHEN 'completed'   THEN 'delivered'
      WHEN 'cancelled'   THEN 'cancelled'
      ELSE 'draft'
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_lifecycle_stage ON public.orders(lifecycle_stage);

-- Spine gets a chain-break flag: set when an active deal on the spine is cancelled,
-- so the owner sees the chain is broken even though the rollup shows the worst leg.
ALTER TABLE public.spines
  ADD COLUMN IF NOT EXISTS chain_broken BOOLEAN NOT NULL DEFAULT false;
