-- Migration: Add shipment pallets table and pallet assignment to packages
-- Purpose: Allow grouping of packages into pallets for shipments

-- Create shipment_pallets table
CREATE TABLE shipment_pallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE NOT NULL,
  pallet_number INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shipment_id, pallet_number)
);

-- Index for efficient lookup by shipment
CREATE INDEX idx_shipment_pallets_shipment ON shipment_pallets(shipment_id);

-- Add pallet_id to inventory_packages (nullable - packages can be "loose")
ALTER TABLE inventory_packages
  ADD COLUMN pallet_id UUID REFERENCES shipment_pallets(id) ON DELETE SET NULL;

-- Index for efficient lookup by pallet
CREATE INDEX idx_inventory_packages_pallet ON inventory_packages(pallet_id);

-- Comment for documentation
COMMENT ON TABLE shipment_pallets IS 'Pallets within a shipment for grouping packages';
COMMENT ON COLUMN shipment_pallets.pallet_number IS 'Sequential number within the shipment (1, 2, 3...)';
COMMENT ON COLUMN inventory_packages.pallet_id IS 'Optional pallet assignment - NULL means loose/unassigned';
