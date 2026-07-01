-- E1 · Spine — one traceable identity linking a chain of bilateral deals.
-- Additive & idempotent: introduces `spines` + `spine_lineage` + `orders.spine_id`.
-- Existing behavior is unchanged (deals keep working exactly as before).

-- ── spines ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL UNIQUE,               -- SP-NNN via next_counter('spine')
  title          TEXT,
  life_stage     TEXT NOT NULL DEFAULT 'spec'        -- Spec → Lot life-stages
                   CHECK (life_stage IN ('spec','lot')),
  status         TEXT NOT NULL DEFAULT 'draft',      -- rolled-up status cache (recomputed from member deals in E4)
  product_group  TEXT,
  origin         TEXT NOT NULL DEFAULT 'root'        -- lineage: how this spine came to be
                   CHECK (origin IN ('root','split','merge')),
  parent_spine_id UUID REFERENCES public.spines(id) ON DELETE SET NULL,  -- split parent (SP-042 → SP-042-A/-B)
  notes          TEXT,
  created_by     UUID REFERENCES public.portal_users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spines_code        ON public.spines(code);
CREATE INDEX IF NOT EXISTS idx_spines_life_stage  ON public.spines(life_stage);
CREATE INDEX IF NOT EXISTS idx_spines_parent      ON public.spines(parent_spine_id) WHERE parent_spine_id IS NOT NULL;

-- ── spine_lineage (many-to-many for splits & merges) ───────────────────────
CREATE TABLE IF NOT EXISTS public.spine_lineage (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spine_id         UUID NOT NULL REFERENCES public.spines(id) ON DELETE CASCADE,  -- resulting spine
  related_spine_id UUID NOT NULL REFERENCES public.spines(id) ON DELETE CASCADE,  -- source spine
  relation         TEXT NOT NULL CHECK (relation IN ('split_from','merged_from')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (spine_id, related_spine_id, relation)
);
CREATE INDEX IF NOT EXISTS idx_spine_lineage_spine   ON public.spine_lineage(spine_id);
CREATE INDEX IF NOT EXISTS idx_spine_lineage_related ON public.spine_lineage(related_spine_id);

-- ── attach deals (orders) to a spine ───────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS spine_id UUID REFERENCES public.spines(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_spine ON public.orders(spine_id) WHERE spine_id IS NOT NULL;

-- ── updated_at trigger (reuse the existing deal-layer helper) ───────────────
DROP TRIGGER IF EXISTS trg_spines_updated_at ON public.spines;
CREATE TRIGGER trg_spines_updated_at
  BEFORE UPDATE ON public.spines
  FOR EACH ROW EXECUTE FUNCTION public.deals_set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
-- A spine is visible to platform admins, or to any org that is a party on one
-- of its deals (mirrors the orders visibility model). Writes are admin/service
-- only for now — deal creation wires the spine server-side (admin client).
ALTER TABLE public.spines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spine_lineage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spines_select_authenticated ON public.spines;
CREATE POLICY spines_select_authenticated ON public.spines
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.spine_id = spines.id
        AND ( public.current_user_in_org(o.seller_organisation_id)
           OR public.current_user_in_org(o.customer_organisation_id)
           OR public.current_user_in_org(o.producer_organisation_id) )
    )
  );

DROP POLICY IF EXISTS spines_write_admin ON public.spines;
CREATE POLICY spines_write_admin ON public.spines
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

DROP POLICY IF EXISTS spine_lineage_select_authenticated ON public.spine_lineage;
CREATE POLICY spine_lineage_select_authenticated ON public.spine_lineage
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE (o.spine_id = spine_lineage.spine_id OR o.spine_id = spine_lineage.related_spine_id)
        AND ( public.current_user_in_org(o.seller_organisation_id)
           OR public.current_user_in_org(o.customer_organisation_id)
           OR public.current_user_in_org(o.producer_organisation_id) )
    )
  );

DROP POLICY IF EXISTS spine_lineage_write_admin ON public.spine_lineage;
CREATE POLICY spine_lineage_write_admin ON public.spine_lineage
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- ── seed the spine counter scope ───────────────────────────────────────────
INSERT INTO public.deal_counters(scope, last_value)
  VALUES ('spine', 0)
  ON CONFLICT (scope) DO NOTHING;
