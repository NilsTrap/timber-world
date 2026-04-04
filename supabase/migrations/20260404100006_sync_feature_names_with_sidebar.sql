-- Sync feature categories/names with sidebar labels

-- Marketing → CMS
UPDATE features SET category = 'CMS', name = 'View CMS' WHERE code = 'marketing.view';

-- Quotes → Quote Requests
UPDATE features SET category = 'Quote Requests', name = 'View Quote Requests' WHERE code = 'quotes.view';
UPDATE features SET category = 'Quote Requests', name = 'Create Quote Requests' WHERE code = 'quotes.create';
UPDATE features SET category = 'Quote Requests', name = 'Edit Quote Requests' WHERE code = 'quotes.edit';

-- Organizations → Users
UPDATE features SET category = 'Users', name = 'View Users' WHERE code = 'organizations.view';
UPDATE features SET category = 'Users', name = 'Create Users' WHERE code = 'organizations.create';
UPDATE features SET category = 'Users', name = 'Edit Users' WHERE code = 'organizations.edit';
UPDATE features SET category = 'Users', name = 'Delete Users' WHERE code = 'organizations.delete';

-- Remove Reference Data features (no longer a sidebar module)
DELETE FROM features WHERE code IN ('reference.view', 'reference.manage');

-- Add missing sidebar modules
INSERT INTO features (code, name, description, category, sort_order) VALUES
  ('uk-staircase-pricing.view', 'View UK Staircase Pricing', 'View UK staircase pricing page', 'UK Staircase Pricing', 850),
  ('competitor-pricing.view', 'View Competitor Pricing', 'View competitor pricing page', 'Competitor Pricing', 860)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;
