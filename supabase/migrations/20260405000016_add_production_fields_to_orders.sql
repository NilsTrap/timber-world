-- Add production m³ fields to orders (manually editable)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tread_m3 numeric,
  ADD COLUMN IF NOT EXISTS winder_m3 numeric,
  ADD COLUMN IF NOT EXISTS quarter_m3 numeric,
  ADD COLUMN IF NOT EXISTS used_material_m3 numeric;
