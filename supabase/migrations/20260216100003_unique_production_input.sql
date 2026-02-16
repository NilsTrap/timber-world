-- Add unique constraint to prevent duplicate packages in production inputs
-- A package can only be added once per production entry

ALTER TABLE portal_production_inputs
ADD CONSTRAINT portal_production_inputs_entry_package_unique
UNIQUE (production_entry_id, package_id);
