-- Add source_shipment_id to track original incoming shipment
-- This preserves the history of where packages came from

ALTER TABLE inventory_packages
ADD COLUMN source_shipment_id UUID REFERENCES shipments(id);

-- Add comment
COMMENT ON COLUMN inventory_packages.source_shipment_id IS 'Original incoming shipment that brought this package into the organization. Preserved when package is sent out.';

-- Create index for queries
CREATE INDEX idx_inventory_packages_source_shipment ON inventory_packages(source_shipment_id);

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';
