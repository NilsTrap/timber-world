-- Add price columns to inventory_packages
-- These prices are displayed only in the marketing app's "In Stock" page
-- NULL values will display as "On Request"

ALTER TABLE inventory_packages
ADD COLUMN unit_price_piece INTEGER,
ADD COLUMN unit_price_m3 INTEGER,
ADD COLUMN unit_price_m2 INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN inventory_packages.unit_price_piece IS 'Price per piece in EUR cents (e.g., 12864 = €128.64). NULL = On Request';
COMMENT ON COLUMN inventory_packages.unit_price_m3 IS 'Price per cubic meter in EUR cents (e.g., 247000 = €2470.00). NULL = On Request';
COMMENT ON COLUMN inventory_packages.unit_price_m2 IS 'Price per square meter in EUR cents (e.g., 4940 = €49.40). NULL = On Request';
