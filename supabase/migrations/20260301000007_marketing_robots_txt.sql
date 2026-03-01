-- Marketing robots.txt Configuration
-- Created: 2026-03-01
-- Seed default robots.txt content

INSERT INTO marketing_texts (category, section, key, locale, value, sort_order) VALUES
('meta', 'global', 'robotsTxt', 'en', '# robots.txt for timber-international.com
User-agent: *
Allow: /

# Sitemaps
Sitemap: https://timber-international.com/sitemap.xml', 0);
