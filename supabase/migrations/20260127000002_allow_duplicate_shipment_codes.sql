-- Migration: Allow duplicate shipment codes
-- Removes the unique constraint on shipment_code to allow admin flexibility

DROP INDEX IF EXISTS shipments_shipment_code_unique;
