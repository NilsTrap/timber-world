-- Stock Prices Table
-- Stores TIM stock/order prices per species, panel type, quality, thickness, and length range

CREATE TABLE stock_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species TEXT NOT NULL,
  panel_type TEXT NOT NULL,
  quality TEXT NOT NULL,
  thickness TEXT NOT NULL DEFAULT 'All',
  length_range TEXT NOT NULL,
  order_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (species, panel_type, quality, thickness, length_range)
);

-- RLS
ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON stock_prices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role full access" ON stock_prices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed with default data
INSERT INTO stock_prices (species, panel_type, quality, thickness, length_range, order_price, stock_price) VALUES
  -- Oak
  ('Oak', 'FJ', 'AB', 'All', 'All', 2100, 2800),
  ('Oak', 'FS', 'AB', 'All', '900-1199', 2850, 3800),
  ('Oak', 'FS', 'AB', 'All', '1200-1499', 3150, 4200),
  ('Oak', 'FS', 'AB', 'All', '1500-1799', 3375, 4500),
  ('Oak', 'FS', 'AB', 'All', '1800-2099', 3600, 4800),
  ('Oak', 'FS', 'AB', 'All', '2100-2499', 4350, 5800),
  ('Oak', 'FS', 'AB', 'All', '2500-3000', 4950, 6600),
  ('Oak', 'FS', 'AB', 'All', '3001-3500', 0, 0),
  -- Birch
  ('Birch', 'FJ', 'AB', 'All', 'All', 1365, 1820),
  ('Birch', 'FS', 'AB', 'All', '900-1199', 1500, 2000),
  ('Birch', 'FS', 'AB', 'All', '1200-1499', 1575, 2100),
  ('Birch', 'FS', 'AB', 'All', '1500-1799', 1650, 2200),
  ('Birch', 'FS', 'AB', 'All', '1800-2099', 1725, 2300),
  ('Birch', 'FS', 'AB', 'All', '2100-2499', 1800, 2400),
  ('Birch', 'FS', 'AB', 'All', '2500-3000', 1875, 2500),
  ('Birch', 'FS', 'AB', 'All', '3001-3500', 0, 0),
  -- Ash
  ('Ash', 'FJ', 'AB', 'All', 'All', 1852.5, 2470),
  ('Ash', 'FS', 'AB', 'All', '900-1199', 2175, 2900),
  ('Ash', 'FS', 'AB', 'All', '1200-1499', 2250, 3000),
  ('Ash', 'FS', 'AB', 'All', '1500-1799', 2325, 3100),
  ('Ash', 'FS', 'AB', 'All', '1800-2099', 2400, 3200),
  ('Ash', 'FS', 'AB', 'All', '2100-2499', 2475, 3300),
  ('Ash', 'FS', 'AB', 'All', '2500-3000', 2550, 3400),
  ('Ash', 'FS', 'AB', 'All', '3001-3500', 0, 0),
  -- Pine
  ('Pine', 'FJ', 'AA', 'All', 'All', 885, 1180),
  ('Pine', 'FS', 'AB', 'All', '900-1199', 937.5, 1250),
  ('Pine', 'FS', 'AB', 'All', '1200-1499', 937.5, 1250),
  ('Pine', 'FS', 'AB', 'All', '1500-1799', 937.5, 1250),
  ('Pine', 'FS', 'AB', 'All', '1800-2099', 937.5, 1250),
  ('Pine', 'FS', 'AB', 'All', '2100-2499', 937.5, 1250),
  ('Pine', 'FS', 'AB', 'All', '2500-3000', 937.5, 1250),
  ('Pine', 'FS', 'AB', 'All', '3001-3500', 0, 0);

NOTIFY pgrst, 'reload schema';
