-- Rename the FK constraint to match the renamed column
-- PostgreSQL does not auto-rename constraints when columns are renamed
ALTER TABLE orders RENAME CONSTRAINT orders_organisation_id_fkey TO orders_customer_organisation_id_fkey;
