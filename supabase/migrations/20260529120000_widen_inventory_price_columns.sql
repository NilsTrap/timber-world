-- Widen order-product price columns from integer to numeric.
--
-- unit_price_piece / unit_price_m2 / unit_price_m3 were integer, but the portal
-- reads and writes them as decimal pounds (OrderProductsSection uses
-- toFixed(2) / parseFloat). Entering a price with pence (e.g. 125.50) sent
-- "125.5" to an integer column and failed with
-- "invalid input syntax for type integer". The sibling price columns
-- (eur_per_m3, work_per_piece, transport_per_piece) are already numeric.
-- Widening integer -> numeric is lossless (existing whole-pound values fit).

ALTER TABLE inventory_packages ALTER COLUMN unit_price_piece TYPE numeric;
ALTER TABLE inventory_packages ALTER COLUMN unit_price_m2 TYPE numeric;
ALTER TABLE inventory_packages ALTER COLUMN unit_price_m3 TYPE numeric;
