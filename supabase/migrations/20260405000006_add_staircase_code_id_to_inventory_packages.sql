-- Add staircase_code_id to inventory_packages so the selected staircase code
-- persists across page reloads for ordered products.
ALTER TABLE inventory_packages
  ADD COLUMN staircase_code_id uuid REFERENCES uk_staircase_pricing(id) ON DELETE SET NULL;
