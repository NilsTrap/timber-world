-- Add Timber International price columns to competitor_prices table
-- This enables price comparison between competitor and TI prices

ALTER TABLE competitor_prices
ADD COLUMN ti_price_per_piece DECIMAL(10,2),
ADD COLUMN ti_price_per_m2 DECIMAL(10,2),
ADD COLUMN price_diff_percent DECIMAL(5,2);

-- Add comments
COMMENT ON COLUMN competitor_prices.ti_price_per_piece IS 'Timber International price per piece in EUR';
COMMENT ON COLUMN competitor_prices.ti_price_per_m2 IS 'Timber International price per m² in EUR';
COMMENT ON COLUMN competitor_prices.price_diff_percent IS 'Price difference: positive = competitor more expensive';

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';
