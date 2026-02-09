-- =============================================
-- Seed Products for Marketing Catalog
-- Migration: 20260208000001_seed_marketing_products.sql
-- Description: Add sample products for the marketing website catalog
-- =============================================

-- Insert sample oak panel products
INSERT INTO products (sku, species, width, length, thickness, quality_grade, type, moisture_content, finish, fsc_certified, unit_price_m3, unit_price_piece, unit_price_m2, stock_quantity, stock_status) VALUES
-- Finger-Jointed Oak Panels
('OAK-FJ-18-200-2000-A', 'European Oak', 200, 2000, 18, 'A', 'FJ', 8.0, 'Unfinished', true, 145000, 5220, 7250, 150, 'in_stock'),
('OAK-FJ-18-200-2400-A', 'European Oak', 200, 2400, 18, 'A', 'FJ', 8.0, 'Unfinished', true, 145000, 6264, 7250, 80, 'in_stock'),
('OAK-FJ-18-300-2000-A', 'European Oak', 300, 2000, 18, 'A', 'FJ', 8.0, 'Unfinished', true, 148000, 7992, 7400, 120, 'in_stock'),
('OAK-FJ-18-400-2000-A', 'European Oak', 400, 2000, 18, 'A', 'FJ', 8.0, 'Unfinished', true, 152000, 10944, 7600, 45, 'low_stock'),
('OAK-FJ-20-200-2000-AB', 'European Oak', 200, 2000, 20, 'A/B', 'FJ', 8.0, 'Unfinished', true, 138000, 5520, 6900, 200, 'in_stock'),
('OAK-FJ-20-300-2400-AB', 'European Oak', 300, 2400, 20, 'A/B', 'FJ', 8.0, 'Unfinished', false, 138000, 9936, 6900, 95, 'in_stock'),
('OAK-FJ-26-200-2000-A', 'European Oak', 200, 2000, 26, 'A', 'FJ', 8.0, 'Unfinished', true, 155000, 8060, 7750, 60, 'in_stock'),
('OAK-FJ-26-300-2400-A', 'European Oak', 300, 2400, 26, 'A', 'FJ', 8.0, 'Unfinished', true, 155000, 17856, 7750, 25, 'low_stock'),
('OAK-FJ-40-400-2000-AB', 'European Oak', 400, 2000, 40, 'A/B', 'FJ', 8.0, 'Unfinished', true, 165000, 21120, 8250, 15, 'low_stock'),
('OAK-FJ-40-600-3000-B', 'European Oak', 600, 3000, 40, 'B', 'FJ', 8.0, 'Unfinished', false, 158000, 45504, 7900, 8, 'low_stock'),

-- Full-Stave Oak Panels (Premium)
('OAK-FS-20-200-2000-A', 'European Oak', 200, 2000, 20, 'A', 'FS', 8.0, 'Unfinished', true, 195000, 7800, 9750, 50, 'in_stock'),
('OAK-FS-20-300-2000-A', 'European Oak', 300, 2000, 20, 'A', 'FS', 8.0, 'Unfinished', true, 198000, 11880, 9900, 35, 'in_stock'),
('OAK-FS-26-200-2400-A', 'European Oak', 200, 2400, 26, 'A', 'FS', 8.0, 'Unfinished', true, 205000, 12792, 10250, 28, 'low_stock'),
('OAK-FS-26-400-2400-AB', 'European Oak', 400, 2400, 26, 'A/B', 'FS', 8.0, 'Unfinished', false, 185000, 18278, 9250, 40, 'in_stock'),
('OAK-FS-40-300-2000-A', 'European Oak', 300, 2000, 40, 'A', 'FS', 8.0, 'Unfinished', true, 225000, 27000, 11250, 12, 'low_stock'),

-- Oiled Finish Products
('OAK-FJ-20-200-2000-A-OIL', 'European Oak', 200, 2000, 20, 'A', 'FJ', 8.0, 'Natural Oil', true, 168000, 6720, 8400, 45, 'in_stock'),
('OAK-FJ-20-300-2400-A-OIL', 'European Oak', 300, 2400, 20, 'A', 'FJ', 8.0, 'Natural Oil', true, 168000, 12096, 8400, 30, 'in_stock'),
('OAK-FS-20-200-2000-A-OIL', 'European Oak', 200, 2000, 20, 'A', 'FS', 8.0, 'Natural Oil', true, 225000, 9000, 11250, 22, 'low_stock'),

-- Lacquered Finish Products
('OAK-FJ-18-200-2000-A-LAC', 'European Oak', 200, 2000, 18, 'A', 'FJ', 8.0, 'Lacquered', true, 175000, 6300, 8750, 35, 'in_stock'),
('OAK-FJ-26-300-2400-AB-LAC', 'European Oak', 300, 2400, 26, 'A/B', 'FJ', 8.0, 'Lacquered', false, 172000, 19814, 8600, 18, 'low_stock'),

-- White Oak Variety
('WOAK-FJ-20-200-2000-A', 'White Oak', 200, 2000, 20, 'A', 'FJ', 8.0, 'Unfinished', true, 158000, 6320, 7900, 65, 'in_stock'),
('WOAK-FJ-20-300-2400-A', 'White Oak', 300, 2400, 20, 'A', 'FJ', 8.0, 'Unfinished', true, 158000, 11376, 7900, 42, 'in_stock'),
('WOAK-FS-26-200-2000-A', 'White Oak', 200, 2000, 26, 'A', 'FS', 8.0, 'Unfinished', true, 215000, 11180, 10750, 20, 'low_stock'),

-- Out of Stock Items (for filter testing)
('OAK-FJ-50-500-3000-A', 'European Oak', 500, 3000, 50, 'A', 'FJ', 8.0, 'Unfinished', true, 185000, 83250, 9250, 0, 'out_of_stock'),
('OAK-FS-50-400-2400-A', 'European Oak', 400, 2400, 50, 'A', 'FS', 8.0, 'Natural Oil', true, 265000, 50880, 13250, 0, 'out_of_stock');

-- Add a comment
COMMENT ON TABLE products IS 'Product catalog for timber products - seeded with marketing sample data';
