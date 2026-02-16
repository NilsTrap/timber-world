-- Add invoice_number column to portal_production_entries table
-- This allows tracking which invoice covers each production entry

ALTER TABLE portal_production_entries
ADD COLUMN invoice_number VARCHAR(100) DEFAULT NULL;

COMMENT ON COLUMN portal_production_entries.invoice_number IS 'Invoice number for this production entry (manually entered)';
