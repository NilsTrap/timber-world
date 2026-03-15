-- Add panel_type column to competitor_prices table
ALTER TABLE competitor_prices ADD COLUMN panel_type TEXT;

-- Create index for filtering
CREATE INDEX idx_competitor_prices_panel_type ON competitor_prices (panel_type);
CREATE INDEX idx_competitor_prices_species ON competitor_prices (species);

-- Backfill panel_type from product_url for existing records
UPDATE competitor_prices
SET panel_type = CASE
  WHEN product_url LIKE '%sormjatk%' THEN 'FJ'
  WHEN product_url LIKE '%pikk-lamell%' THEN 'FS'
  ELSE NULL
END
WHERE panel_type IS NULL;

-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
