-- Universalize `orders` into the canonical deal model (Oscar-integration phase).
--
-- Additive only. The existing UK-stairs order flow (order products via
-- inventory_packages + order_staircases) keeps working untouched; this adds a
-- generic, attribute-driven line-item table + universal deal fields + document
-- storage, so one model serves malka / boards / stairs / anything.
--
-- Reuses deal_counters + next_counter() (generic scope counters from
-- 20260615000001) and the `deal-documents` storage bucket.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Universal deal fields on orders (additive; UK-stairs columns untouched)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deal_kind TEXT NOT NULL DEFAULT 'buy_sell'
  CHECK (deal_kind IN ('buy_sell', 'sale_only', 'purchase_only'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_group TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS incoterms TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS incoterms_place TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS advance_pct NUMERIC(5,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_terms TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_deadline TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS transport_billing TEXT NOT NULL DEFAULT 'in_price'
  CHECK (transport_billing IN ('in_price', 'separate_line', 'separate_invoice'));
-- Deal code in Nils's convention (entity+client+seq), alongside the existing ORD-### code.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deal_code TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Generic, attribute-driven line items
--    Text columns are the free-form fallback; *_option_id point at the shared
--    catalog_field_options registry (the system-wide attribute vocabulary).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_line_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  side                  TEXT NOT NULL DEFAULT 'sell' CHECK (side IN ('sell', 'buy')),
  line_no               INTEGER NOT NULL DEFAULT 1,
  product_name          TEXT,
  wood_species          TEXT,
  humidity              TEXT,
  processing            TEXT,
  quality               TEXT,
  product_type          TEXT,
  grade_note            TEXT,
  -- standardized attribute links (controlled vocabulary)
  product_name_option_id  UUID REFERENCES public.catalog_field_options(id) ON DELETE SET NULL,
  wood_species_option_id  UUID REFERENCES public.catalog_field_options(id) ON DELETE SET NULL,
  humidity_option_id      UUID REFERENCES public.catalog_field_options(id) ON DELETE SET NULL,
  processing_option_id    UUID REFERENCES public.catalog_field_options(id) ON DELETE SET NULL,
  quality_option_id       UUID REFERENCES public.catalog_field_options(id) ON DELETE SET NULL,
  product_type_option_id  UUID REFERENCES public.catalog_field_options(id) ON DELETE SET NULL,
  thickness             TEXT,   -- TEXT: ranges "40-50", dual nominals "29 (26)"
  width                 TEXT,
  length                TEXT,
  pieces                TEXT,
  volume_m3             NUMERIC(14,4),
  unit                  TEXT NOT NULL DEFAULT 'm3' CHECK (unit IN ('m3','m2','piece','linear_m','package')),
  unit_price_cents      INTEGER,
  vat_rate              NUMERIC(5,2),
  line_total_cents      INTEGER,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_line_items_order ON public.order_line_items(order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Client-supplied reference codes (project / job / PO) shown on documents
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_external_refs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  ref_type   TEXT NOT NULL CHECK (ref_type IN ('client_project','client_job','client_po','other')),
  ref_value  TEXT NOT NULL,
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_external_refs_order ON public.order_external_refs(order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Generated-document store (Timber-side, so employees access invoices/CMRs
--    in the deal view). oscar_* columns hold the Oscar copy once generation
--    moves there.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL CHECK (doc_type IN
                 ('sales_spec','purchase_spec','contract','proforma_invoice','invoice','packing_list','cmr')),
  side         TEXT NOT NULL DEFAULT 'sell' CHECK (side IN ('sell','buy')),
  doc_number   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued')),
  storage_path TEXT,
  file_name    TEXT,
  payload      JSONB,
  oscar_doc_id  TEXT,
  oscar_doc_url TEXT,
  generated_by UUID REFERENCES public.portal_users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_documents_order ON public.order_documents(order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. updated_at trigger for line items (reuse the generic fn from deals migration)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_order_line_items_updated_at ON public.order_line_items;
CREATE TRIGGER trg_order_line_items_updated_at BEFORE UPDATE ON public.order_line_items
  FOR EACH ROW EXECUTE FUNCTION public.deals_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS — access follows the parent order's party orgs (mirrors orders policy)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_access_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = p_order_id
      AND (
        public.is_current_user_platform_admin()
        OR public.current_user_in_org(o.customer_organisation_id)
        OR public.current_user_in_org(o.seller_organisation_id)
        OR public.current_user_in_org(o.producer_organisation_id)
      )
  )
$$;
GRANT EXECUTE ON FUNCTION public.can_access_order(UUID) TO authenticated, service_role;

ALTER TABLE public.order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_external_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_line_items_rw ON public.order_line_items;
CREATE POLICY order_line_items_rw ON public.order_line_items
  FOR ALL TO authenticated
  USING (public.can_access_order(order_id))
  WITH CHECK (public.can_access_order(order_id));

DROP POLICY IF EXISTS order_external_refs_rw ON public.order_external_refs;
CREATE POLICY order_external_refs_rw ON public.order_external_refs
  FOR ALL TO authenticated
  USING (public.can_access_order(order_id))
  WITH CHECK (public.can_access_order(order_id));

DROP POLICY IF EXISTS order_documents_rw ON public.order_documents;
CREATE POLICY order_documents_rw ON public.order_documents
  FOR ALL TO authenticated
  USING (public.can_access_order(order_id))
  WITH CHECK (public.can_access_order(order_id));
