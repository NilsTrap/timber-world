-- =============================================
-- E5 · Link deal line-items to the catalog + owner margin approval
-- Migration: 20260701000015_order_line_catalog_link.sql
--
-- A deal line-item may point at a priced catalog variant (standard product,
-- auto-priced) or carry a per-deal price (non-standard). The *_option_id
-- attribute FKs already exist (20260616000001); this adds the product/variant
-- link + a standard flag. Also adds the owner margin-approval flag on orders
-- (spec §5.3; automatic minimum-margin rules deferred §1.3).
-- =============================================

ALTER TABLE public.order_line_items
  ADD COLUMN IF NOT EXISTS catalog_product_id UUID REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_variant_id UUID REFERENCES public.catalog_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_standard BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_order_line_items_catalog_variant
  ON public.order_line_items(catalog_variant_id)
  WHERE catalog_variant_id IS NOT NULL;

COMMENT ON COLUMN public.order_line_items.is_standard IS 'E5: true = priced from a catalog variant (catalog_variant_id set); false = non-standard, per-deal price';

-- Owner margin approval (manual; per-deal). NULL = not yet approved.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS margin_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS margin_approved_by UUID REFERENCES public.portal_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.orders.margin_approved_at IS 'E5: owner-approved the deal margin at this time (manual; auto rules deferred)';
