-- Marketing URL Slugs
-- Created: 2026-03-01
-- Seed URL slugs for each page

INSERT INTO marketing_texts (category, section, key, locale, value, sort_order) VALUES
-- URL slugs for all pages
('meta', 'home', 'slug', 'en', '/', 0),
('meta', 'products', 'slug', 'en', '/products', 9),
('meta', 'quote', 'slug', 'en', '/quote', 19),
('meta', 'contact', 'slug', 'en', '/contact', 29),
('meta', 'privacy', 'slug', 'en', '/privacy', 39),
('meta', 'terms', 'slug', 'en', '/terms', 49),
('meta', 'about', 'slug', 'en', '/about', 59);
