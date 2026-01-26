-- Migration: Restore shipment code uniqueness with exceptions
-- Shipment codes must be unique EXCEPT for 'ADMIN' and '-' (empty placeholder)

-- Recreate the unique index with exceptions for ADMIN and hyphen
CREATE UNIQUE INDEX shipments_shipment_code_unique
  ON shipments (shipment_code)
  WHERE shipment_code NOT IN ('ADMIN', '-', '');
