-- =============================================
-- Timber International Seed Data
-- Description: Sample data for development and testing
-- =============================================

-- Sample Products
INSERT INTO products (sku, species, width, length, thickness, quality_grade, type, moisture_content, finish, fsc_certified, unit_price_m3, unit_price_piece, unit_price_m2, stock_quantity, stock_status)
VALUES
  -- Oak Finger-Jointed Panels
  ('OAK-FJ-22-1200', 'Oak', 600, 1200, 22, 'A/B', 'FJ', 8.0, 'Unfinished', true, 250000, 4500, 12500, 150, 'in_stock'),
  ('OAK-FJ-22-2400', 'Oak', 600, 2400, 22, 'A/B', 'FJ', 8.0, 'Unfinished', true, 250000, 9000, 12500, 85, 'in_stock'),
  ('OAK-FJ-27-1200', 'Oak', 600, 1200, 27, 'A/B', 'FJ', 8.0, 'Unfinished', true, 280000, 5500, 14000, 120, 'in_stock'),
  ('OAK-FJ-27-2400', 'Oak', 600, 2400, 27, 'A/B', 'FJ', 8.0, 'Unfinished', true, 280000, 11000, 14000, 45, 'low_stock'),

  -- Oak Full-Stave Panels
  ('OAK-FS-22-1200', 'Oak', 600, 1200, 22, 'A', 'FS', 8.0, 'Unfinished', true, 320000, 5800, 16000, 75, 'in_stock'),
  ('OAK-FS-22-2400', 'Oak', 600, 2400, 22, 'A', 'FS', 8.0, 'Unfinished', true, 320000, 11600, 16000, 30, 'low_stock'),
  ('OAK-FS-27-1200', 'Oak', 600, 1200, 27, 'A', 'FS', 8.0, 'Unfinished', true, 350000, 6800, 17500, 60, 'in_stock'),
  ('OAK-FS-27-2400', 'Oak', 600, 2400, 27, 'A', 'FS', 8.0, 'Unfinished', true, 350000, 13600, 17500, 0, 'out_of_stock'),

  -- Oak with Natural Oil Finish
  ('OAK-FJ-22-1200-NAT', 'Oak', 600, 1200, 22, 'A/B', 'FJ', 8.0, 'Natural Oil', true, 280000, 5000, 14000, 50, 'in_stock'),
  ('OAK-FJ-27-2400-NAT', 'Oak', 600, 2400, 27, 'A/B', 'FJ', 8.0, 'Natural Oil', true, 310000, 12200, 15500, 25, 'low_stock'),

  -- Oak White Oiled
  ('OAK-FJ-22-1200-WHT', 'Oak', 600, 1200, 22, 'A/B', 'FJ', 8.0, 'White Oil', true, 290000, 5200, 14500, 40, 'in_stock'),
  ('OAK-FS-27-1200-WHT', 'Oak', 600, 1200, 27, 'A', 'FS', 8.0, 'White Oil', true, 380000, 7400, 19000, 20, 'low_stock');

-- Note: Admin users should be created through the Supabase Auth flow
-- and then linked in the admin_users table

-- Sample Quote Request (for testing)
INSERT INTO quote_requests (type, status, contact_name, contact_email, contact_phone, company_name, delivery_location, products, notes)
VALUES
  (
    'stock',
    'pending',
    'Erik Lindqvist',
    'erik@nordicfurniture.se',
    '+46 70 123 4567',
    'Nordic Furniture AB',
    'Sweden',
    '[
      {"sku": "OAK-FJ-22-1200", "name": "Oak Panel FJ 22×1200", "quantity": 50, "unit": "pieces"},
      {"sku": "OAK-FS-27-2400", "name": "Oak Panel FS 27×2400", "quantity": 25, "unit": "pieces"}
    ]'::jsonb,
    'Need delivery within 6 weeks for upcoming furniture production run.'
  ),
  (
    'custom',
    'pending',
    'Anna Korhonen',
    'anna@stairsolution.fi',
    '+358 40 987 6543',
    'Stair Solutions Oy',
    'Finland',
    NULL,
    '{
      "dimensions": {"width": 400, "length": 3000, "thickness": 40},
      "finish": "Natural Oil",
      "cnc_requirements": "Stair treads with bullnose edge, anti-slip grooves",
      "notes": "Custom stair treads for residential project, 24 pieces needed"
    }'::jsonb,
    'Urgent project - need quote ASAP. Open to discussion on specifications.'
  );
