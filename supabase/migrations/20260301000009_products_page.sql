-- Products Page
-- Created: 2026-03-01
-- Add Products page meta, product images, and product texts

-- 1. Products page meta data
INSERT INTO marketing_texts (category, section, key, locale, value, sort_order) VALUES
('meta', 'products', 'slug', 'en', '/products', 4),
('meta', 'products', 'title', 'en', 'Products | Premium Oak Panels & Wood Solutions', 5),
('meta', 'products', 'description', 'en', 'Explore our range of premium oak panels, finger jointed boards, and custom wood solutions. Quality craftsmanship from sustainable European forests.', 6),
('meta', 'products', 'sitemapInclude', 'en', 'true', 7),
('meta', 'products', 'sitemapPriority', 'en', '0.8', 8),
('meta', 'products', 'sitemapChangeFreq', 'en', 'weekly', 9);

-- 2. Update marketing_media category constraint to include 'product'
ALTER TABLE marketing_media DROP CONSTRAINT IF EXISTS marketing_media_category_check;
ALTER TABLE marketing_media ADD CONSTRAINT marketing_media_category_check
  CHECK (category IN ('journey', 'hero', 'logo', 'product'));

-- 3. Product image slots (10 products)
INSERT INTO marketing_media (category, slot_key, file_name, storage_path, mime_type, alt_text, sort_order) VALUES
('product', 'product-1', '', 'product/product-1/', 'image/jpeg', 'Product 1', 1),
('product', 'product-2', '', 'product/product-2/', 'image/jpeg', 'Product 2', 2),
('product', 'product-3', '', 'product/product-3/', 'image/jpeg', 'Product 3', 3),
('product', 'product-4', '', 'product/product-4/', 'image/jpeg', 'Product 4', 4),
('product', 'product-5', '', 'product/product-5/', 'image/jpeg', 'Product 5', 5),
('product', 'product-6', '', 'product/product-6/', 'image/jpeg', 'Product 6', 6),
('product', 'product-7', '', 'product/product-7/', 'image/jpeg', 'Product 7', 7),
('product', 'product-8', '', 'product/product-8/', 'image/jpeg', 'Product 8', 8),
('product', 'product-9', '', 'product/product-9/', 'image/jpeg', 'Product 9', 9),
('product', 'product-10', '', 'product/product-10/', 'image/jpeg', 'Product 10', 10);

-- 4. Product texts (titles and descriptions)
INSERT INTO marketing_texts (category, section, key, locale, value, sort_order) VALUES
('products', 'product-1', 'title', 'en', 'Oak Finger Jointed Panel', 1),
('products', 'product-1', 'description', 'en', 'Premium finger jointed oak panels, ideal for furniture and interior applications.', 2),
('products', 'product-2', 'title', 'en', 'Oak Full Stave Panel', 3),
('products', 'product-2', 'description', 'en', 'Solid full stave oak panels showcasing natural wood grain patterns.', 4),
('products', 'product-3', 'title', 'en', 'Oak Stair Tread', 5),
('products', 'product-3', 'description', 'en', 'Durable oak stair treads with anti-slip finish options available.', 6),
('products', 'product-4', 'title', 'en', 'Oak Window Sill', 7),
('products', 'product-4', 'description', 'en', 'Classic oak window sills in various depths and finishes.', 8),
('products', 'product-5', 'title', 'en', 'Oak Worktop', 9),
('products', 'product-5', 'description', 'en', 'Robust oak worktops for kitchens and workspaces.', 10),
('products', 'product-6', 'title', 'en', 'Oak Shelving', 11),
('products', 'product-6', 'description', 'en', 'Versatile oak shelving solutions for any room.', 12),
('products', 'product-7', 'title', 'en', 'Oak Table Top', 13),
('products', 'product-7', 'description', 'en', 'Custom oak table tops in various dimensions.', 14),
('products', 'product-8', 'title', 'en', 'Oak Flooring Panel', 15),
('products', 'product-8', 'description', 'en', 'Engineered oak flooring panels for durability and beauty.', 16),
('products', 'product-9', 'title', 'en', 'Oak Door Panel', 17),
('products', 'product-9', 'description', 'en', 'Solid oak door panels for interior applications.', 18),
('products', 'product-10', 'title', 'en', 'Custom Oak Solution', 19),
('products', 'product-10', 'description', 'en', 'Bespoke oak products tailored to your specifications.', 20);
