-- Add columns to store filter values discovered from the competitor website
-- These are the actual available values scraped from the site's filter UI

ALTER TABLE scraper_config
  ADD COLUMN discovered_thicknesses INTEGER[] DEFAULT '{}',
  ADD COLUMN discovered_widths INTEGER[] DEFAULT '{}',
  ADD COLUMN discovered_lengths INTEGER[] DEFAULT '{}',
  ADD COLUMN discovered_at TIMESTAMPTZ;

-- Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
