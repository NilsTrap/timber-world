-- Add seller organisation to orders
-- organisation_id = customer (buyer)
-- seller_organisation_id = the org fulfilling/taking the order

ALTER TABLE orders
  ADD COLUMN seller_organisation_id UUID REFERENCES organisations(id);

CREATE INDEX idx_orders_seller_organisation ON orders(seller_organisation_id);
