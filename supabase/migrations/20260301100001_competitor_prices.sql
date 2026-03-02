-- Competitor Prices Table
-- Stores pricing data scraped from competitor websites (e.g., mass.ee)

CREATE TABLE competitor_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                          -- Source identifier (e.g., "mass.ee")
  product_name TEXT NOT NULL,                    -- Product name from scraper
  species TEXT,                                  -- Wood species (e.g., "oak", "tamm")
  thickness_mm INTEGER NOT NULL,                 -- Panel thickness
  width_mm INTEGER NOT NULL,                     -- Panel width
  length_mm INTEGER NOT NULL,                    -- Panel length
  quality TEXT,                                  -- Quality grade (A/B, B/C, etc.)
  price_per_piece DECIMAL(10,2),                 -- Price per piece in EUR
  price_per_m2 DECIMAL(10,2),                    -- Price per m² in EUR
  stock_total INTEGER DEFAULT 0,                 -- Total stock count
  stock_locations JSONB DEFAULT '{}',            -- Stock by location {"tallinn": 3, "tartu": 0}
  product_url TEXT,                              -- Source URL
  scraped_at TIMESTAMPTZ NOT NULL,               -- When this data was scraped
  created_at TIMESTAMPTZ DEFAULT now()           -- When record was inserted
);

-- Index for common queries
CREATE INDEX idx_competitor_prices_source_scraped ON competitor_prices (source, scraped_at DESC);
CREATE INDEX idx_competitor_prices_thickness ON competitor_prices (thickness_mm);

-- RLS policies (admin read only)
ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (for admin portal display)
CREATE POLICY "Allow authenticated read" ON competitor_prices
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role full access (for scraper insert operations)
CREATE POLICY "Allow service role full access" ON competitor_prices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';
