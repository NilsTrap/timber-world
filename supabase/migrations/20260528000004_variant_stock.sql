-- ============================================================================
-- Per-variant stock. Quantity is held in one unit — single pieces or packages —
-- and converted to the category's base unit (m²/m³/m/pcs) for display via the
-- variant's default packaging.
-- ============================================================================

ALTER TABLE public.catalog_variants
  ADD COLUMN stock_quantity NUMERIC,
  ADD COLUMN stock_unit TEXT NOT NULL DEFAULT 'piece'
    CHECK (stock_unit IN ('piece', 'package'));
