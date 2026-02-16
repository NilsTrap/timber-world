-- Add planned and actual work amounts to portal_production_entries
-- These track the forecasted vs actual work done for each production entry

ALTER TABLE portal_production_entries
ADD COLUMN planned_work DECIMAL(12, 4),
ADD COLUMN actual_work DECIMAL(12, 4);

COMMENT ON COLUMN portal_production_entries.planned_work IS 'Planned/forecasted work amount in the process work unit';
COMMENT ON COLUMN portal_production_entries.actual_work IS 'Actual work amount completed in the process work unit';
