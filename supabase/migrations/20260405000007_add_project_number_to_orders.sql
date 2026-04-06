-- Add project_number column to orders
ALTER TABLE orders
  ADD COLUMN project_number TEXT;
