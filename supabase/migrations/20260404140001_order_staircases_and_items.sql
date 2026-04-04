-- =============================================
-- Order Staircases & Items
-- Migration: 20260404140001_order_staircases_and_items.sql
-- Description: Staircase grouping and line items for stair part orders
-- =============================================

-- =============================================
-- 1. ORDER STAIRCASES (groups parts by staircase)
-- =============================================

CREATE TABLE order_staircases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Staircase 1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_staircases_order ON order_staircases(order_id, sort_order);

CREATE TRIGGER order_staircases_updated_at
  BEFORE UPDATE ON order_staircases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 2. ORDER ITEMS (individual stair parts)
-- =============================================

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_staircase_id UUID NOT NULL REFERENCES order_staircases(id) ON DELETE CASCADE,
  pricing_product_id UUID NOT NULL REFERENCES uk_staircase_pricing(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- Snapshot pricing at time of order (so price changes don't affect existing orders)
  unit_price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (currency IN ('EUR', 'GBP', 'USD')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_items_staircase ON order_items(order_staircase_id, sort_order);
CREATE INDEX idx_order_items_pricing ON order_items(pricing_product_id);

CREATE TRIGGER order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 3. RLS POLICIES
-- =============================================

ALTER TABLE order_staircases ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to order_staircases"
  ON order_staircases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access to order_items"
  ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 4. RELOAD POSTGREST CACHE
-- =============================================

NOTIFY pgrst, 'reload schema';
