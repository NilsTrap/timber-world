-- Add sort_order column to stock_prices for custom ordering
ALTER TABLE stock_prices ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Set sort order: Oak first, then Birch, Ash, Pine. FJ before FS. Lengths in numeric order.
-- Oak FJ
UPDATE stock_prices SET sort_order = 1 WHERE species = 'Oak' AND panel_type = 'FJ';
-- Oak FS
UPDATE stock_prices SET sort_order = 2 WHERE species = 'Oak' AND panel_type = 'FS' AND length_range = '900-1199';
UPDATE stock_prices SET sort_order = 3 WHERE species = 'Oak' AND panel_type = 'FS' AND length_range = '1200-1499';
UPDATE stock_prices SET sort_order = 4 WHERE species = 'Oak' AND panel_type = 'FS' AND length_range = '1500-1799';
UPDATE stock_prices SET sort_order = 5 WHERE species = 'Oak' AND panel_type = 'FS' AND length_range = '1800-2099';
UPDATE stock_prices SET sort_order = 6 WHERE species = 'Oak' AND panel_type = 'FS' AND length_range = '2100-2499';
UPDATE stock_prices SET sort_order = 7 WHERE species = 'Oak' AND panel_type = 'FS' AND length_range = '2500-3000';
UPDATE stock_prices SET sort_order = 8 WHERE species = 'Oak' AND panel_type = 'FS' AND length_range = '3001-3500';
-- Birch FJ
UPDATE stock_prices SET sort_order = 10 WHERE species = 'Birch' AND panel_type = 'FJ';
-- Birch FS
UPDATE stock_prices SET sort_order = 11 WHERE species = 'Birch' AND panel_type = 'FS' AND length_range = '900-1199';
UPDATE stock_prices SET sort_order = 12 WHERE species = 'Birch' AND panel_type = 'FS' AND length_range = '1200-1499';
UPDATE stock_prices SET sort_order = 13 WHERE species = 'Birch' AND panel_type = 'FS' AND length_range = '1500-1799';
UPDATE stock_prices SET sort_order = 14 WHERE species = 'Birch' AND panel_type = 'FS' AND length_range = '1800-2099';
UPDATE stock_prices SET sort_order = 15 WHERE species = 'Birch' AND panel_type = 'FS' AND length_range = '2100-2499';
UPDATE stock_prices SET sort_order = 16 WHERE species = 'Birch' AND panel_type = 'FS' AND length_range = '2500-3000';
UPDATE stock_prices SET sort_order = 17 WHERE species = 'Birch' AND panel_type = 'FS' AND length_range = '3001-3500';
-- Ash FJ
UPDATE stock_prices SET sort_order = 20 WHERE species = 'Ash' AND panel_type = 'FJ';
-- Ash FS
UPDATE stock_prices SET sort_order = 21 WHERE species = 'Ash' AND panel_type = 'FS' AND length_range = '900-1199';
UPDATE stock_prices SET sort_order = 22 WHERE species = 'Ash' AND panel_type = 'FS' AND length_range = '1200-1499';
UPDATE stock_prices SET sort_order = 23 WHERE species = 'Ash' AND panel_type = 'FS' AND length_range = '1500-1799';
UPDATE stock_prices SET sort_order = 24 WHERE species = 'Ash' AND panel_type = 'FS' AND length_range = '1800-2099';
UPDATE stock_prices SET sort_order = 25 WHERE species = 'Ash' AND panel_type = 'FS' AND length_range = '2100-2499';
UPDATE stock_prices SET sort_order = 26 WHERE species = 'Ash' AND panel_type = 'FS' AND length_range = '2500-3000';
UPDATE stock_prices SET sort_order = 27 WHERE species = 'Ash' AND panel_type = 'FS' AND length_range = '3001-3500';
-- Pine FJ
UPDATE stock_prices SET sort_order = 30 WHERE species = 'Pine' AND panel_type = 'FJ';
-- Pine FS
UPDATE stock_prices SET sort_order = 31 WHERE species = 'Pine' AND panel_type = 'FS' AND length_range = '900-1199';
UPDATE stock_prices SET sort_order = 32 WHERE species = 'Pine' AND panel_type = 'FS' AND length_range = '1200-1499';
UPDATE stock_prices SET sort_order = 33 WHERE species = 'Pine' AND panel_type = 'FS' AND length_range = '1500-1799';
UPDATE stock_prices SET sort_order = 34 WHERE species = 'Pine' AND panel_type = 'FS' AND length_range = '1800-2099';
UPDATE stock_prices SET sort_order = 35 WHERE species = 'Pine' AND panel_type = 'FS' AND length_range = '2100-2499';
UPDATE stock_prices SET sort_order = 36 WHERE species = 'Pine' AND panel_type = 'FS' AND length_range = '2500-3000';
UPDATE stock_prices SET sort_order = 37 WHERE species = 'Pine' AND panel_type = 'FS' AND length_range = '3001-3500';

NOTIFY pgrst, 'reload schema';
