-- Fix Analytics Paths
-- Created: 2026-03-01
-- Update historical analytics data: /products -> /stock
-- The "In Stock" page was previously at /products URL before being renamed to /stock
-- The new Products gallery page now uses /products

-- Update page_path in analytics_events
UPDATE analytics_events
SET page_path = REPLACE(page_path, '/products', '/stock')
WHERE page_path LIKE '%/products%'
  AND created_at < '2026-03-01';

-- Also update any page_path that exactly matches locale/products patterns
UPDATE analytics_events
SET page_path = REPLACE(page_path, '/products', '/stock')
WHERE (page_path = '/products'
   OR page_path LIKE '%/products?%'
   OR page_path ~ '^/[a-z]{2}/products')
  AND created_at < '2026-03-01';
