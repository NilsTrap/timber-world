-- =============================================
-- E5 · Per-surface visibility for catalog categories + products
-- Migration: 20260701000014_catalog_surface_visibility.sql
--
-- Lets each category/product show only where wanted: the agents storefront,
-- the internal portal, and (future) the public marketing site. Catalog RLS is
-- permissive all-read, so filtering is enforced app-side at the query sites.
-- Defaults: agents/internal visible; marketing opt-in (off).
-- =============================================

ALTER TABLE public.catalog_categories
  ADD COLUMN IF NOT EXISTS visible_agents    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_internal  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_marketing BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS visible_agents    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_internal  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_marketing BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.catalog_categories.visible_agents IS 'E5: show this category on the agents storefront';
COMMENT ON COLUMN public.catalog_categories.visible_internal IS 'E5: show this category in the internal portal (deal picker etc.)';
COMMENT ON COLUMN public.catalog_categories.visible_marketing IS 'E5: expose this category on the public marketing site (opt-in)';
