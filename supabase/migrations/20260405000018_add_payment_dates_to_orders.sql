-- Add payment date fields to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS production_payment_date date,
  ADD COLUMN IF NOT EXISTS wood_art_payment_date date;
