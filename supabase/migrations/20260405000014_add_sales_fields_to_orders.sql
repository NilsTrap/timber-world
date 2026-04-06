-- Add sales-related fields to orders table
ALTER TABLE orders ADD COLUMN invoice_number TEXT;
ALTER TABLE orders ADD COLUMN package_number TEXT;
ALTER TABLE orders ADD COLUMN transport_invoice_number TEXT;
ALTER TABLE orders ADD COLUMN transport_price TEXT;
