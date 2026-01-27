-- Allow admin-added inventory packages without shipment or production source
-- This enables direct inventory additions by admin without creating shipments

-- Drop the constraint that requires shipment_id or production_entry_id
ALTER TABLE inventory_packages DROP CONSTRAINT IF EXISTS chk_package_source;

-- Note: Packages can now exist with both shipment_id = NULL and production_entry_id = NULL
-- This is valid for admin-added inventory
