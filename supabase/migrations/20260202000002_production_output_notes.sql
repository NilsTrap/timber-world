-- Add notes column to production outputs for package-level comments
ALTER TABLE portal_production_outputs
ADD COLUMN notes TEXT;
