-- E3 · Configurable gate engine (spec §6, §9.4).
-- A GATE = the requirements to advance a deal FROM a stage to the next, per deal-type.
-- Config is edited IN-APP by an admin (never in code). Empty/absent requirements →
-- the stage auto-advances. Building blocks live in `requirements` JSONB, e.g.:
--   { "type": "party_signoff", "party": "seller" | "buyer" }
--   { "type": "acceptance" }                                   -- buyer acceptance
--   { "type": "condition", "condition": "payment_recorded" }
--   { "type": "condition", "condition": "document_present", "docType": "invoice" }
-- Gates are kept SEPARATE from groups/rights (spec §9.4) — configured here, not with roles.

CREATE TABLE IF NOT EXISTS public.deal_gates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_kind    TEXT NOT NULL DEFAULT 'buy_sell',
  from_stage   TEXT NOT NULL CHECK (from_stage IN ('draft','confirmed','produced','loaded')),
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_kind, from_stage)
);

-- Per-deal confirmations that satisfy a gate's party_signoff / acceptance blocks.
-- (condition blocks are evaluated live from deal state, not stored here.)
CREATE TABLE IF NOT EXISTS public.deal_gate_confirmations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_stage        TEXT NOT NULL,
  block_type        TEXT NOT NULL,   -- 'party_signoff' | 'acceptance'
  block_key         TEXT NOT NULL,   -- 'seller' | 'buyer' | 'acceptance'
  confirmed_by_org  UUID REFERENCES public.organisations(id),
  confirmed_by_user UUID REFERENCES public.portal_users(id),
  confirmed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, from_stage, block_type, block_key)
);

CREATE INDEX IF NOT EXISTS idx_deal_gate_conf_order ON public.deal_gate_confirmations(order_id);

DROP TRIGGER IF EXISTS trg_deal_gates_updated_at ON public.deal_gates;
CREATE TRIGGER trg_deal_gates_updated_at BEFORE UPDATE ON public.deal_gates
  FOR EACH ROW EXECUTE FUNCTION public.deals_set_updated_at();

-- RLS ------------------------------------------------------------------------
ALTER TABLE public.deal_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_gate_confirmations ENABLE ROW LEVEL SECURITY;

-- Gate CONFIG: policy config readable by any authenticated user (the engine reads it);
-- writable admin-only (in-app config is an admin action).
DROP POLICY IF EXISTS deal_gates_select ON public.deal_gates;
CREATE POLICY deal_gates_select ON public.deal_gates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS deal_gates_write_admin ON public.deal_gates;
CREATE POLICY deal_gates_write_admin ON public.deal_gates
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- Confirmations: visible to / insertable by a party of the deal (or admin).
DROP POLICY IF EXISTS deal_gate_conf_select ON public.deal_gate_confirmations;
CREATE POLICY deal_gate_conf_select ON public.deal_gate_confirmations
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_platform_admin() OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = deal_gate_confirmations.order_id AND (
        public.current_user_in_org(o.seller_organisation_id) OR
        public.current_user_in_org(o.buyer_organisation_id) OR
        public.current_user_in_org(o.customer_organisation_id) OR
        public.current_user_in_org(o.producer_organisation_id))));
DROP POLICY IF EXISTS deal_gate_conf_insert ON public.deal_gate_confirmations;
CREATE POLICY deal_gate_conf_insert ON public.deal_gate_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_user_platform_admin() OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = deal_gate_confirmations.order_id AND (
        public.current_user_in_org(o.seller_organisation_id) OR
        public.current_user_in_org(o.buyer_organisation_id) OR
        public.current_user_in_org(o.customer_organisation_id) OR
        public.current_user_in_org(o.producer_organisation_id))));
DROP POLICY IF EXISTS deal_gate_conf_delete_admin ON public.deal_gate_confirmations;
CREATE POLICY deal_gate_conf_delete_admin ON public.deal_gate_confirmations
  FOR DELETE TO authenticated
  USING (public.is_current_user_platform_admin());
