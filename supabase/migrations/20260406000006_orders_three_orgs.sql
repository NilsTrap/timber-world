-- Rename organisation_id → customer_organisation_id
-- Add producer_organisation_id
-- Migrate data: current seller_organisation_id is actually producer, set seller to TWG

-- 1. Rename customer column
ALTER TABLE orders RENAME COLUMN organisation_id TO customer_organisation_id;

-- 2. Add producer column
ALTER TABLE orders ADD COLUMN producer_organisation_id UUID REFERENCES organisations(id);
CREATE INDEX idx_orders_producer_organisation ON orders(producer_organisation_id);

-- 3. Data migration: current seller_organisation_id values are actually producer data
UPDATE orders
SET producer_organisation_id = seller_organisation_id
WHERE seller_organisation_id IS NOT NULL;

-- 4. Set seller to The Wooden Good for all existing orders
UPDATE orders
SET seller_organisation_id = (SELECT id FROM organisations WHERE code = 'TWG');

-- 5. Rename the old index to match new column name
ALTER INDEX idx_orders_organisation RENAME TO idx_orders_customer_organisation;
