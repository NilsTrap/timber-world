-- Add final_price_cents column to uk_staircase_pricing
ALTER TABLE uk_staircase_pricing
ADD COLUMN final_price_cents INTEGER NOT NULL DEFAULT 0;

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';
