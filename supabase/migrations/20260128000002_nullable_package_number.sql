-- Allow NULL package numbers in portal_production_outputs
-- Package numbers are now assigned manually via "Assign Package Numbers" button
-- instead of being auto-generated on insert

-- Make package_number nullable
ALTER TABLE portal_production_outputs
ALTER COLUMN package_number DROP NOT NULL;

-- Add sort_order column to preserve row ordering
ALTER TABLE portal_production_outputs
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_portal_production_outputs_sort_order
ON portal_production_outputs(production_entry_id, sort_order);

NOTIFY pgrst, 'reload schema';
