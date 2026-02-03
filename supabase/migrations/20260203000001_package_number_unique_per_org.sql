-- Package numbers should be unique per organization, not globally
-- This allows different organizations to use the same package number sequence

-- Drop the global unique constraint on package_number
ALTER TABLE inventory_packages DROP CONSTRAINT IF EXISTS inventory_packages_package_number_key;

-- Add composite unique constraint for (organisation_id, package_number)
-- This ensures package numbers are unique within each organization
-- Note: organisation_id can be NULL for legacy packages, so we need a partial index for those
CREATE UNIQUE INDEX inventory_packages_org_package_unique
ON inventory_packages (organisation_id, package_number)
WHERE organisation_id IS NOT NULL;

-- For packages without organisation_id (legacy), keep global uniqueness
-- This is a partial index for NULL organisation_id
CREATE UNIQUE INDEX inventory_packages_package_global_unique
ON inventory_packages (package_number)
WHERE organisation_id IS NULL;

COMMENT ON INDEX inventory_packages_org_package_unique IS
'Package numbers are unique within each organization';
COMMENT ON INDEX inventory_packages_package_global_unique IS
'Legacy packages without organisation_id maintain global uniqueness';
