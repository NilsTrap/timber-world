-- Allow NULL package_sequence in inventory_packages for admin-added packages
-- Package sequence is only relevant within a shipment context

-- Make package_sequence nullable
ALTER TABLE inventory_packages
ALTER COLUMN package_sequence DROP NOT NULL;

-- The existing partial unique indexes already handle NULL shipment_id cases:
-- - idx_inventory_packages_shipment_seq: ON (shipment_id, package_sequence) WHERE shipment_id IS NOT NULL
-- - idx_inventory_packages_production_seq: ON (production_entry_id, package_sequence) WHERE production_entry_id IS NOT NULL

NOTIFY pgrst, 'reload schema';
