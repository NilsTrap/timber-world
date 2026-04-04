-- Sort features alphabetically by category for consistent display
UPDATE features SET sort_order = 100 WHERE category = 'CMS';
UPDATE features SET sort_order = 200 WHERE category = 'Competitor Pricing';
UPDATE features SET sort_order = 300 WHERE category = 'CRM';
UPDATE features SET sort_order = 400 WHERE category = 'Dashboard';
UPDATE features SET sort_order = 500 WHERE category = 'Inventory';
UPDATE features SET sort_order = 600 WHERE category = 'Orders';
UPDATE features SET sort_order = 700 WHERE category = 'Production';
UPDATE features SET sort_order = 800 WHERE category = 'Quote Requests';
UPDATE features SET sort_order = 900 WHERE category = 'Shipments';
UPDATE features SET sort_order = 1000 WHERE category = 'UK Staircase Pricing';
UPDATE features SET sort_order = 1100 WHERE category = 'Users';

-- Within each category, sort: view first, then alphabetically
UPDATE features SET sort_order = sort_order + 0 WHERE code LIKE '%.view';
UPDATE features SET sort_order = sort_order + 1 WHERE code LIKE '%.create';
UPDATE features SET sort_order = sort_order + 2 WHERE code LIKE '%.edit';
UPDATE features SET sort_order = sort_order + 3 WHERE code LIKE '%.delete';
UPDATE features SET sort_order = sort_order + 4 WHERE code LIKE '%.validate';
UPDATE features SET sort_order = sort_order + 5 WHERE code LIKE '%.submit';
UPDATE features SET sort_order = sort_order + 6 WHERE code LIKE '%.accept';
UPDATE features SET sort_order = sort_order + 7 WHERE code LIKE '%.reject';
UPDATE features SET sort_order = sort_order + 8 WHERE code LIKE '%.manage';
UPDATE features SET sort_order = sort_order + 9 WHERE code LIKE '%.corrections';
