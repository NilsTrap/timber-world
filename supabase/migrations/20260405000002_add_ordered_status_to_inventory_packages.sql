-- Add 'ordered' to the inventory_packages status check constraint
ALTER TABLE inventory_packages
  DROP CONSTRAINT IF EXISTS inventory_packages_status_check;

ALTER TABLE inventory_packages
  ADD CONSTRAINT inventory_packages_status_check
  CHECK (status IN ('available', 'reserved', 'consumed', 'produced', 'ordered'));

COMMENT ON COLUMN inventory_packages.status IS 'Package status: available, reserved, consumed, produced, ordered';
