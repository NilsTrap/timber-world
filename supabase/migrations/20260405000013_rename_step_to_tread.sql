-- Rename step_length to tread_length on orders table
ALTER TABLE orders RENAME COLUMN step_length TO tread_length;

-- Rename "Step" product name to "Tread" in reference data
UPDATE ref_product_names SET value = 'Tread' WHERE value = 'Step';

-- Rename step entries in uk_staircase_pricing to use "Tread"
UPDATE uk_staircase_pricing SET name = REPLACE(name, 'Step', 'Tread') WHERE name LIKE 'Step%';
