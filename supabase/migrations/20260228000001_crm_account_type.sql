-- Add account_type column to crm_companies
-- This stores the Companies House filing category (micro-entity, small, medium, large, dormant, etc.)

ALTER TABLE crm_companies
ADD COLUMN IF NOT EXISTS account_type TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN crm_companies.account_type IS 'Companies House account filing type (micro-entity, small, medium, dormant, etc.)';
