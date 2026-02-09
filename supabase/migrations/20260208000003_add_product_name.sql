-- Add name column to products table
ALTER TABLE products ADD COLUMN name VARCHAR(100);

-- Set default name for all existing products
UPDATE products SET name = 'Solidwood Panels';

-- Make the column NOT NULL after setting defaults
ALTER TABLE products ALTER COLUMN name SET NOT NULL;
