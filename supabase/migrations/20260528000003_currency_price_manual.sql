-- ============================================================================
-- Manual per-entity currency price overrides.
-- A derived currency price can be hand-set; manual rows are preserved when the
-- ECB conversion run recomputes the rest.
-- ============================================================================

ALTER TABLE public.catalog_currency_prices
  ADD COLUMN is_manual BOOLEAN NOT NULL DEFAULT false;
