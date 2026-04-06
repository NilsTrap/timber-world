-- Add production cost fields to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS production_material numeric,
  ADD COLUMN IF NOT EXISTS production_work numeric,
  ADD COLUMN IF NOT EXISTS production_finishing numeric,
  ADD COLUMN IF NOT EXISTS production_invoice_number text,
  ADD COLUMN IF NOT EXISTS wood_art numeric,
  ADD COLUMN IF NOT EXISTS glowing numeric,
  ADD COLUMN IF NOT EXISTS wood_art_cnc numeric,
  ADD COLUMN IF NOT EXISTS wood_art_invoice_number text;
