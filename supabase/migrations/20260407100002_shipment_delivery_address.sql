-- Add delivery address text fields to shipments for print documents
-- These are free-text fields that default from org delivery addresses but can be edited per shipment
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS delivery_from_text TEXT,
  ADD COLUMN IF NOT EXISTS delivery_to_text TEXT;
