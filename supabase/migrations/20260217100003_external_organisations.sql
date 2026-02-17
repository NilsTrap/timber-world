-- Add external flag to organisations
-- External organisations are suppliers/customers that don't use the platform
-- They can only be the source of incoming shipments (not outgoing)

ALTER TABLE organisations
ADD COLUMN is_external BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN organisations.is_external IS 'External organisations do not use the platform. They can only be sources for incoming shipments.';

-- Add index for filtering
CREATE INDEX idx_organisations_is_external ON organisations(is_external) WHERE is_external = true;
