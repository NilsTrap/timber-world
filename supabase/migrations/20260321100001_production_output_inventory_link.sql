-- Add inventory_package_id to portal_production_outputs
-- Links individually validated output packages to their inventory_packages record
ALTER TABLE portal_production_outputs
  ADD COLUMN inventory_package_id UUID REFERENCES inventory_packages(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX idx_production_outputs_inventory_package_id
  ON portal_production_outputs(inventory_package_id)
  WHERE inventory_package_id IS NOT NULL;
