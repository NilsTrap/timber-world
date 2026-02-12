-- Add indexes to inventory_packages for faster catalog queries
-- These indexes optimize the product catalog page which filters by status='available'
-- and joins with reference tables

-- Index on status (most important - every query filters by this)
CREATE INDEX IF NOT EXISTS idx_inventory_packages_status
ON inventory_packages(status);

-- Composite index for the common query pattern: status + organisation
CREATE INDEX IF NOT EXISTS idx_inventory_packages_status_org
ON inventory_packages(status, organisation_id);

-- Indexes on foreign key columns for faster joins
CREATE INDEX IF NOT EXISTS idx_inventory_packages_product_name_id
ON inventory_packages(product_name_id);

CREATE INDEX IF NOT EXISTS idx_inventory_packages_wood_species_id
ON inventory_packages(wood_species_id);

CREATE INDEX IF NOT EXISTS idx_inventory_packages_type_id
ON inventory_packages(type_id);

CREATE INDEX IF NOT EXISTS idx_inventory_packages_quality_id
ON inventory_packages(quality_id);

CREATE INDEX IF NOT EXISTS idx_inventory_packages_humidity_id
ON inventory_packages(humidity_id);

-- Add indexes to reference tables for faster lookups
CREATE INDEX IF NOT EXISTS idx_ref_product_names_value
ON ref_product_names(value);

CREATE INDEX IF NOT EXISTS idx_ref_wood_species_value
ON ref_wood_species(value);

CREATE INDEX IF NOT EXISTS idx_ref_types_value
ON ref_types(value);

CREATE INDEX IF NOT EXISTS idx_ref_quality_value
ON ref_quality(value);

CREATE INDEX IF NOT EXISTS idx_ref_humidity_value
ON ref_humidity(value);
