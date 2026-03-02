-- Scraper Configuration Table
-- Stores configuration for competitor price scrapers

CREATE TABLE scraper_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL UNIQUE,                    -- Source identifier (e.g., "mass.ee")
  is_enabled BOOLEAN DEFAULT true,                -- Enable/disable this source
  species TEXT[] DEFAULT '{}',                    -- Species to scrape ["oak"]
  thicknesses INTEGER[] DEFAULT '{}',             -- Thicknesses in mm [20, 26, 30, 40]
  widths INTEGER[] DEFAULT '{}',                  -- Widths in mm [620, 1020, 1220]
  lengths INTEGER[] DEFAULT '{}',                 -- Lengths in mm [800, 900, ...]
  panel_types TEXT[] DEFAULT '{}',                -- Panel types ["FJ", "FS"]
  qualities TEXT[] DEFAULT '{}',                  -- Quality grades ["A/B", "B/C"]
  updated_at TIMESTAMPTZ DEFAULT now()            -- Last update time
);

-- Index for source lookup
CREATE INDEX idx_scraper_config_source ON scraper_config (source);

-- RLS policies
ALTER TABLE scraper_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON scraper_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update (admin check done in application)
CREATE POLICY "Allow authenticated update" ON scraper_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow service role full access (for scraper operations)
CREATE POLICY "Allow service role full access" ON scraper_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed mass.ee with default values
INSERT INTO scraper_config (source, is_enabled, species, thicknesses, widths, lengths, panel_types, qualities)
VALUES (
  'mass.ee',
  true,
  ARRAY['oak'],
  ARRAY[20, 26, 30, 40],
  ARRAY[620, 1020, 1220],
  ARRAY[800, 900, 1000, 1200, 1450, 1500, 2000, 2100, 2500],
  ARRAY['FJ', 'FS'],
  ARRAY['A/B', 'B/C']
);

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';
