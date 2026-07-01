-- E3 · Spine rollup + chain-break as a DB-owned cache (SECURITY DEFINER trigger).
--
-- The spine's rolled-up status and chain_broken flag are a CACHE derived from its
-- deals' lifecycle stages. Maintaining that cache in app code fails for non-admin
-- operators: spine writes are admin-only (RLS), but any party who can access a deal
-- may advance/cancel it — their spine UPDATE would be silently RLS-filtered, leaving
-- the rollup stale. So the cache is maintained by a trigger on `orders` that runs
-- with definer rights, independent of who mutated the deal. App code now only writes
-- orders.lifecycle_stage; the spine cache follows automatically.

-- Least-advanced ACTIVE stage on a spine; all-cancelled → cancelled; no deals → draft.
CREATE OR REPLACE FUNCTION public.recompute_spine_rollup(p_spine_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage TEXT;
BEGIN
  IF p_spine_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(
    (SELECT lifecycle_stage
       FROM public.orders
      WHERE spine_id = p_spine_id AND lifecycle_stage <> 'cancelled'
      ORDER BY CASE lifecycle_stage
        WHEN 'draft'     THEN 0
        WHEN 'confirmed' THEN 1
        WHEN 'produced'  THEN 2
        WHEN 'loaded'    THEN 3
        WHEN 'delivered' THEN 4
        ELSE 0 END
      LIMIT 1),
    (CASE WHEN EXISTS (SELECT 1 FROM public.orders WHERE spine_id = p_spine_id)
          THEN 'cancelled' ELSE 'draft' END)
  ) INTO v_stage;

  UPDATE public.spines SET status = v_stage WHERE id = p_spine_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_orders_spine_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- refresh rollup for the affected spine(s)
  IF TG_OP = 'UPDATE' AND NEW.spine_id IS DISTINCT FROM OLD.spine_id AND OLD.spine_id IS NOT NULL THEN
    PERFORM public.recompute_spine_rollup(OLD.spine_id);
  END IF;
  PERFORM public.recompute_spine_rollup(NEW.spine_id);

  -- chain-break flag when a deal is cancelled from an active stage (≤ loaded):
  -- flag its own spine + the spines of any downstream deals it was sourcing.
  IF TG_OP = 'UPDATE'
     AND NEW.lifecycle_stage = 'cancelled'
     AND OLD.lifecycle_stage IN ('draft','confirmed','produced','loaded') THEN
    IF NEW.spine_id IS NOT NULL THEN
      UPDATE public.spines SET chain_broken = true WHERE id = NEW.spine_id;
    END IF;
    UPDATE public.spines SET chain_broken = true
      WHERE id IN (
        SELECT spine_id FROM public.orders
        WHERE upstream_deal_id = NEW.id AND spine_id IS NOT NULL
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_spine_cache ON public.orders;
CREATE TRIGGER trg_orders_spine_cache
  AFTER INSERT OR UPDATE OF lifecycle_stage, spine_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_spine_cache();

-- Backfill the rollup for every existing spine so the cache is correct from the start.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.spines LOOP
    PERFORM public.recompute_spine_rollup(r.id);
  END LOOP;
END $$;
