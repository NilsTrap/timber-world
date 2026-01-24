-- Add correction support to portal_production_entries
-- Corrections are new entries linked to the original validated entry they correct.
-- entry_type: 'standard' (default) or 'correction'
-- corrects_entry_id: FK to the original entry being corrected (null for standard entries)

ALTER TABLE portal_production_entries
  ADD COLUMN entry_type TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE portal_production_entries
  ADD CONSTRAINT portal_production_entries_entry_type_check
  CHECK (entry_type IN ('standard', 'correction'));

ALTER TABLE portal_production_entries
  ADD COLUMN corrects_entry_id UUID REFERENCES portal_production_entries(id);

-- Index for efficient lookup of corrections by original entry
CREATE INDEX idx_portal_production_entries_corrects
  ON portal_production_entries(corrects_entry_id)
  WHERE corrects_entry_id IS NOT NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
