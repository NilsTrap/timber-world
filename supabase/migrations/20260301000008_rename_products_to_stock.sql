-- Rename products slug to stock
-- Created: 2026-03-01

-- Update all meta texts where section = 'products' to section = 'stock'
UPDATE marketing_texts
SET section = 'stock'
WHERE category = 'meta' AND section = 'products';

-- Update the slug value itself
UPDATE marketing_texts
SET value = '/stock'
WHERE category = 'meta' AND section = 'stock' AND key = 'slug';

-- Update meta title
UPDATE marketing_texts
SET value = 'In Stock | Premium Oak Panels & Wood Products'
WHERE category = 'meta' AND section = 'stock' AND key = 'title';
