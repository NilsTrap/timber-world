-- Allow order products to have no package_number.
-- Only real inventory packages (produced / shipped / in-stock) need one.

-- 1. Make package_number nullable
ALTER TABLE inventory_packages ALTER COLUMN package_number DROP NOT NULL;

-- 2. Recreate unique index to only enforce uniqueness when package_number is set
DROP INDEX IF EXISTS inventory_packages_org_package_unique;

CREATE UNIQUE INDEX inventory_packages_org_package_unique
ON inventory_packages (organisation_id, package_number)
WHERE organisation_id IS NOT NULL AND package_number IS NOT NULL;

-- 3. Clear the fake auto-generated package numbers on existing ordered products
UPDATE inventory_packages
SET package_number = NULL
WHERE status = 'ordered' AND order_id IS NOT NULL;
