-- Rename order_date to date_received and add date_loaded
ALTER TABLE orders RENAME COLUMN order_date TO date_received;
ALTER TABLE orders ADD COLUMN date_loaded DATE;
