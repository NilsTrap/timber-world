-- Add price per m³ columns to competitor_prices table

ALTER TABLE competitor_prices
ADD COLUMN price_per_m3 DECIMAL(10,2),
ADD COLUMN ti_price_per_m3 DECIMAL(10,2);

-- Add comments
COMMENT ON COLUMN competitor_prices.price_per_m3 IS 'Mass.ee price per m³ in EUR (calculated from dimensions)';
COMMENT ON COLUMN competitor_prices.ti_price_per_m3 IS 'Timber International price per m³ in EUR';

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';
