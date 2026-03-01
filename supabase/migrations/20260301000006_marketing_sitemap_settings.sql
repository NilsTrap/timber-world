-- Marketing Sitemap Settings
-- Created: 2026-03-01
-- Seed XML sitemap settings for each page

INSERT INTO marketing_texts (category, section, key, locale, value, sort_order) VALUES
-- Home page sitemap settings
('meta', 'home', 'sitemapInclude', 'en', 'true', 3),
('meta', 'home', 'sitemapPriority', 'en', '1.0', 4),
('meta', 'home', 'sitemapChangeFreq', 'en', 'weekly', 5),

-- Products page sitemap settings
('meta', 'products', 'sitemapInclude', 'en', 'true', 12),
('meta', 'products', 'sitemapPriority', 'en', '0.8', 13),
('meta', 'products', 'sitemapChangeFreq', 'en', 'daily', 14),

-- Quote page sitemap settings
('meta', 'quote', 'sitemapInclude', 'en', 'true', 22),
('meta', 'quote', 'sitemapPriority', 'en', '0.8', 23),
('meta', 'quote', 'sitemapChangeFreq', 'en', 'monthly', 24),

-- Contact page sitemap settings
('meta', 'contact', 'sitemapInclude', 'en', 'true', 32),
('meta', 'contact', 'sitemapPriority', 'en', '0.6', 33),
('meta', 'contact', 'sitemapChangeFreq', 'en', 'monthly', 34),

-- Privacy page sitemap settings
('meta', 'privacy', 'sitemapInclude', 'en', 'true', 42),
('meta', 'privacy', 'sitemapPriority', 'en', '0.2', 43),
('meta', 'privacy', 'sitemapChangeFreq', 'en', 'yearly', 44),

-- Terms page sitemap settings
('meta', 'terms', 'sitemapInclude', 'en', 'true', 52),
('meta', 'terms', 'sitemapPriority', 'en', '0.2', 53),
('meta', 'terms', 'sitemapChangeFreq', 'en', 'yearly', 54),

-- About page sitemap settings
('meta', 'about', 'sitemapInclude', 'en', 'true', 62),
('meta', 'about', 'sitemapPriority', 'en', '0.6', 63),
('meta', 'about', 'sitemapChangeFreq', 'en', 'monthly', 64);
