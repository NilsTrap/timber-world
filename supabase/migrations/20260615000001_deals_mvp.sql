-- Deals MVP — universal deal model + document generation foundation.
--
-- Additive only. Does NOT touch the existing `orders` feature (UK-stairs-shaped),
-- which reconciles with this universal model later. Reuses `organisations`
-- (company card: name/address/bank/contact) and the RLS helpers from
-- 20260522000002_rls_helpers.sql.
--
-- One `deals` row carries a SELL side (customer) and a BUY side (producer) — the
-- buy/sell seam. Documents and line items are tagged by side so the seam is real
-- without yet building the multi-entity chained-deal feature.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Atomic counters (deal codes + document numbers; purchase ≠ sale series)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_counters (
  scope       TEXT PRIMARY KEY,
  last_value  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allocate the next value for a scope, atomically. First call returns 1.
CREATE OR REPLACE FUNCTION public.next_counter(p_scope TEXT)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.deal_counters (scope, last_value)
  VALUES (p_scope, 1)
  ON CONFLICT (scope)
  DO UPDATE SET last_value = public.deal_counters.last_value + 1,
               updated_at = now()
  RETURNING last_value;
$$;

COMMENT ON FUNCTION public.next_counter IS
  'Atomically allocate the next sequential integer for a counter scope (deal codes, document numbers). First allocation returns 1.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tables
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deals (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                      TEXT UNIQUE NOT NULL,
  deal_kind                 TEXT NOT NULL DEFAULT 'buy_sell'
                              CHECK (deal_kind IN ('buy_sell', 'sale_only', 'purchase_only')),
  product_group             TEXT,                       -- universal: 'malka' | 'boards' | ...
  seller_organisation_id    UUID REFERENCES public.organisations(id),  -- the trading entity (TIM)
  customer_organisation_id  UUID REFERENCES public.organisations(id),  -- sell-side buyer
  producer_organisation_id  UUID REFERENCES public.organisations(id),  -- buy-side producer
  currency                  TEXT NOT NULL DEFAULT 'EUR'
                              CHECK (currency IN ('EUR', 'GBP', 'USD')),
  incoterms                 TEXT,
  incoterms_place           TEXT,
  advance_pct               NUMERIC(5,2),               -- 0–100, per deal
  payment_terms             TEXT,
  delivery_terms            TEXT,
  delivery_deadline         TEXT,                       -- month-granular free text, per samples
  transport_billing         TEXT NOT NULL DEFAULT 'in_price'
                              CHECK (transport_billing IN ('in_price', 'separate_line', 'separate_invoice')),
  status                    TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','quoted','confirmed','in_progress','shipped','completed','cancelled')),
  notes                     TEXT,
  created_by                UUID REFERENCES public.portal_users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_seller ON public.deals(seller_organisation_id);
CREATE INDEX IF NOT EXISTS idx_deals_customer ON public.deals(customer_organisation_id);
CREATE INDEX IF NOT EXISTS idx_deals_producer ON public.deals(producer_organisation_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON public.deals(status);

CREATE TABLE IF NOT EXISTS public.deal_line_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  side             TEXT NOT NULL DEFAULT 'sell' CHECK (side IN ('sell', 'buy')),
  line_no          INTEGER NOT NULL DEFAULT 1,
  product_name     TEXT,
  wood_species     TEXT,
  humidity         TEXT,
  processing       TEXT,
  quality          TEXT,
  grade_note       TEXT,
  thickness        TEXT,            -- TEXT: ranges like "40-50" and dual nominals "29 (26)"
  width            TEXT,
  length           TEXT,
  pieces           TEXT,
  volume_m3        NUMERIC(14,4),
  unit             TEXT NOT NULL DEFAULT 'm3' CHECK (unit IN ('m3','m2','piece','linear_m','package')),
  unit_price_cents INTEGER,
  vat_rate         NUMERIC(5,2),
  line_total_cents INTEGER,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_line_items_deal ON public.deal_line_items(deal_id);

CREATE TABLE IF NOT EXISTS public.deal_external_refs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  ref_type   TEXT NOT NULL CHECK (ref_type IN ('client_project','client_job','client_po','other')),
  ref_value  TEXT NOT NULL,
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_external_refs_deal ON public.deal_external_refs(deal_id);

CREATE TABLE IF NOT EXISTS public.deal_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL CHECK (doc_type IN
                 ('sales_spec','purchase_spec','contract','proforma_invoice','invoice','packing_list','cmr')),
  side         TEXT NOT NULL DEFAULT 'sell' CHECK (side IN ('sell','buy')),
  doc_number   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued')),
  storage_path TEXT,
  file_name    TEXT,
  payload      JSONB,            -- snapshot of the data the document was rendered from
  generated_by UUID REFERENCES public.portal_users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_documents_deal ON public.deal_documents(deal_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deals_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_updated_at ON public.deals;
CREATE TRIGGER trg_deals_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_set_updated_at();

DROP TRIGGER IF EXISTS trg_deal_line_items_updated_at ON public.deal_line_items;
CREATE TRIGGER trg_deal_line_items_updated_at BEFORE UPDATE ON public.deal_line_items
  FOR EACH ROW EXECUTE FUNCTION public.deals_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS — mirror the orders model (platform admin OR member of a party org).
--    The service-role client (MCP / admin actions) bypasses RLS entirely.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_external_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_documents ENABLE ROW LEVEL SECURITY;

-- deals: a user sees/edits a deal if platform admin or member of any party org.
DROP POLICY IF EXISTS deals_rw ON public.deals;
CREATE POLICY deals_rw ON public.deals
  FOR ALL TO authenticated
  USING (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(seller_organisation_id)
    OR public.current_user_in_org(customer_organisation_id)
    OR public.current_user_in_org(producer_organisation_id)
  )
  WITH CHECK (
    public.is_current_user_platform_admin()
    OR public.current_user_in_org(seller_organisation_id)
    OR public.current_user_in_org(customer_organisation_id)
    OR public.current_user_in_org(producer_organisation_id)
  );

-- child tables: access follows the parent deal.
CREATE OR REPLACE FUNCTION public.can_access_deal(p_deal_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = p_deal_id
      AND (
        public.is_current_user_platform_admin()
        OR public.current_user_in_org(d.seller_organisation_id)
        OR public.current_user_in_org(d.customer_organisation_id)
        OR public.current_user_in_org(d.producer_organisation_id)
      )
  )
$$;

DROP POLICY IF EXISTS deal_line_items_rw ON public.deal_line_items;
CREATE POLICY deal_line_items_rw ON public.deal_line_items
  FOR ALL TO authenticated
  USING (public.can_access_deal(deal_id))
  WITH CHECK (public.can_access_deal(deal_id));

DROP POLICY IF EXISTS deal_external_refs_rw ON public.deal_external_refs;
CREATE POLICY deal_external_refs_rw ON public.deal_external_refs
  FOR ALL TO authenticated
  USING (public.can_access_deal(deal_id))
  WITH CHECK (public.can_access_deal(deal_id));

DROP POLICY IF EXISTS deal_documents_rw ON public.deal_documents;
CREATE POLICY deal_documents_rw ON public.deal_documents
  FOR ALL TO authenticated
  USING (public.can_access_deal(deal_id))
  WITH CHECK (public.can_access_deal(deal_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grants
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.next_counter(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_deal(UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Module registration (sidebar/permission gate)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.modules (code, name, description, category, sort_order)
VALUES ('deals.view', 'Deals', 'Universal deal management with document generation', 'Sales', 50)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Storage bucket for generated documents (private; access via signed URLs
--    minted server-side with the service-role client, so no per-object policies).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-documents', 'deal-documents', false)
ON CONFLICT (id) DO NOTHING;
