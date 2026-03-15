-- Table to store discovered product URLs that actually have products
-- Instead of generating thousands of URL combinations on every scrape,
-- discovery mode populates this table, and regular scraping only visits these URLs.

CREATE TABLE scraper_product_urls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  species TEXT,
  panel_type TEXT,
  thickness_mm INTEGER,
  width_mm INTEGER,
  length_mm INTEGER,
  quality TEXT,
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (source, url)
);

-- Indexes for common queries
CREATE INDEX idx_scraper_product_urls_source ON scraper_product_urls (source);
CREATE INDEX idx_scraper_product_urls_active ON scraper_product_urls (source, is_active);

-- RLS
ALTER TABLE scraper_product_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scraper_product_urls"
  ON scraper_product_urls FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage scraper_product_urls"
  ON scraper_product_urls FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
