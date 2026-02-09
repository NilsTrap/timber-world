-- Add humidity and processing columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS humidity VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS processing VARCHAR(50);

-- Update all existing products with the new values from PDF
UPDATE products SET
  name = 'Solid Wood Panels',
  humidity = 'KD 7-9%',
  processing = 'Sanded';

-- Make columns NOT NULL after setting defaults
ALTER TABLE products ALTER COLUMN humidity SET NOT NULL;
ALTER TABLE products ALTER COLUMN processing SET NOT NULL;
