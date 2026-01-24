-- Add 'validating' as allowed intermediate status for atomic lock pattern
-- This status is used briefly during the validation process to prevent
-- concurrent validation attempts (draft → validating → validated)

ALTER TABLE portal_production_entries
  DROP CONSTRAINT portal_production_entries_status_check;

ALTER TABLE portal_production_entries
  ADD CONSTRAINT portal_production_entries_status_check
  CHECK (status IN ('draft', 'validating', 'validated'));
