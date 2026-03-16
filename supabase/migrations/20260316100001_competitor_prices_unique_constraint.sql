-- Add unique constraint on competitor_prices for upsert support
-- Each product URL per source is unique, enabling upsert on re-scrape

-- First, deduplicate any existing rows (keep the most recent by scraped_at)
DELETE FROM competitor_prices a
USING competitor_prices b
WHERE a.id < b.id
  AND a.source = b.source
  AND a.product_url = b.product_url;

-- Add unique constraint
ALTER TABLE competitor_prices
ADD CONSTRAINT competitor_prices_source_url_unique UNIQUE (source, product_url);

-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
