-- Marketing Meta Tags CMS
-- Created: 2026-03-01
-- Manages meta titles and descriptions for each page

-- Seed meta tags for all pages (using the marketing_texts table)
INSERT INTO marketing_texts (category, section, key, locale, value, sort_order) VALUES
-- Home page
('meta', 'home', 'title', 'en', 'Timber International | Premium Oak Panels from Forest to Product', 1),
('meta', 'home', 'description', 'en', 'Premium oak panels crafted with traditional expertise and sustainable practices, connecting European forests to craftsmen worldwide.', 2),

-- Products/Catalog page
('meta', 'products', 'title', 'en', 'In Stock | Premium Oak Panels & Wood Products', 10),
('meta', 'products', 'description', 'en', 'Browse our selection of premium oak panels. Finger jointed and full stave options available. FSC certified sustainable timber.', 11),

-- Quote page
('meta', 'quote', 'title', 'en', 'Request Quote | Timber International', 20),
('meta', 'quote', 'description', 'en', 'Get a competitive quote for premium oak panels and wood products. Tell us about your project and we will respond within 24 hours.', 21),

-- Contact page
('meta', 'contact', 'title', 'en', 'Contact Us | Timber International', 30),
('meta', 'contact', 'description', 'en', 'Get in touch with Timber International. We are here to help with your oak panel and wood product needs.', 31),

-- Privacy page
('meta', 'privacy', 'title', 'en', 'Privacy Policy | Timber International', 40),
('meta', 'privacy', 'description', 'en', 'Learn about how Timber International collects and uses your data. We respect your privacy.', 41),

-- Terms page
('meta', 'terms', 'title', 'en', 'Terms of Service | Timber International', 50),
('meta', 'terms', 'description', 'en', 'Terms and conditions for using Timber International services and website.', 51),

-- About page (if exists)
('meta', 'about', 'title', 'en', 'About Us | Timber International', 60),
('meta', 'about', 'description', 'en', 'Learn about Timber International - premium oak panels from sustainable European forests to craftsmen worldwide.', 61);
