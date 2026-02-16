-- Add price column to ref_processes table
-- Price per work unit (e.g., price per m³, price per hour)

ALTER TABLE ref_processes
ADD COLUMN price DECIMAL(10, 2) DEFAULT NULL;

COMMENT ON COLUMN ref_processes.price IS 'Price per work unit for this process';
