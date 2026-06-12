-- ============================================================================
-- Agent commissions, self-registration fields, and the agent ordering flow.
-- ============================================================================

-- ─── 1. Per-category commission config (percentages only) ──────────────────
ALTER TABLE public.catalog_categories
  ADD COLUMN commission_standard_pct NUMERIC,
  ADD COLUMN commission_max_discount_pct NUMERIC,
  ADD COLUMN commission_discounted_pct NUMERIC;

-- ─── 2. Agent application status + commission visibility ───────────────────
ALTER TABLE public.agent_users
  ADD COLUMN application_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (application_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN show_commissions BOOLEAN NOT NULL DEFAULT false;

-- Existing agents were created by an admin -> treat as approved.
UPDATE public.agent_users SET application_status = 'approved' WHERE is_active = true;

-- Let a freshly signed-up user create their own (pending) profile row.
CREATE POLICY agent_users_self_insert ON public.agent_users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

-- ─── 3. Agent orders (a cart is a draft order) ─────────────────────────────
CREATE SEQUENCE IF NOT EXISTS agent_order_number_seq;
GRANT USAGE, SELECT ON SEQUENCE agent_order_number_seq TO authenticated, service_role;

CREATE TABLE public.agent_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT 'AO-' || lpad(nextval('agent_order_number_seq')::text, 4, '0'),
  agent_user_id UUID NOT NULL REFERENCES public.agent_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'cart'
    CHECK (status IN ('cart', 'submitted', 'confirmed', 'cancelled')),
  currency_code TEXT NOT NULL DEFAULT 'GBP',
  customer_name TEXT,
  customer_company TEXT,
  delivery_address TEXT,
  notes TEXT,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_total_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  commission_total_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live cart per agent; fast lookups by agent + status.
CREATE UNIQUE INDEX idx_agent_orders_one_cart
  ON public.agent_orders (agent_user_id) WHERE status = 'cart';
CREATE INDEX idx_agent_orders_agent ON public.agent_orders (agent_user_id, status);
CREATE INDEX idx_agent_orders_status ON public.agent_orders (status, created_at DESC);

CREATE TABLE public.agent_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.agent_orders(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.catalog_variants(id) ON DELETE SET NULL,
  -- snapshots taken when the line is added; never rewritten by later catalog edits
  product_name TEXT NOT NULL,
  variant_label TEXT,
  sku TEXT,
  packaging_name TEXT,
  pieces_per_package INTEGER,
  base_qty_per_package NUMERIC,      -- e.g. m² in one package
  unit_symbol TEXT,                  -- e.g. m²
  unit_price_cents INTEGER NOT NULL, -- GBP per pricing unit (snapshot)
  quantity_packages INTEGER NOT NULL DEFAULT 1,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  line_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  commission_pct NUMERIC NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_order_items_order ON public.agent_order_items (order_id);

-- ─── 4. RLS: an agent sees/edits only their own orders; admin sees all ──────
ALTER TABLE public.agent_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_orders_self ON public.agent_orders
  FOR ALL TO authenticated
  USING (
    agent_user_id IN (SELECT id FROM public.agent_users WHERE auth_user_id = auth.uid())
    OR public.is_current_user_platform_admin()
  )
  WITH CHECK (
    agent_user_id IN (SELECT id FROM public.agent_users WHERE auth_user_id = auth.uid())
    OR public.is_current_user_platform_admin()
  );

CREATE POLICY agent_order_items_self ON public.agent_order_items
  FOR ALL TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM public.agent_orders o
      JOIN public.agent_users au ON au.id = o.agent_user_id
      WHERE au.auth_user_id = auth.uid()
    )
    OR public.is_current_user_platform_admin()
  )
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.agent_orders o
      JOIN public.agent_users au ON au.id = o.agent_user_id
      WHERE au.auth_user_id = auth.uid()
    )
    OR public.is_current_user_platform_admin()
  );

-- ─── 5. Triggers ───────────────────────────────────────────────────────────
CREATE TRIGGER agent_orders_updated_at BEFORE UPDATE ON public.agent_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER agent_order_items_updated_at BEFORE UPDATE ON public.agent_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
