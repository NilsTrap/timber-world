-- CRM Company Types table
-- Business type categories (Manufacturer, Installer, Retailer, etc.) that can be assigned to companies

CREATE TABLE IF NOT EXISTS crm_company_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_company_types_name ON crm_company_types(name);

-- Seed initial company type categories
INSERT INTO crm_company_types (name) VALUES
  ('Manufacturer'),
  ('Installer'),
  ('Retailer'),
  ('Designer'),
  ('Builder'),
  ('Trade Supplier'),
  ('Contractor'),
  ('Renovation Specialist')
ON CONFLICT (name) DO NOTHING;

-- Company-Types junction table
CREATE TABLE IF NOT EXISTS crm_company_type_assignments (
  company_id UUID NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES crm_company_types(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, type_id)
);

CREATE INDEX idx_crm_company_type_assignments_company ON crm_company_type_assignments(company_id);
CREATE INDEX idx_crm_company_type_assignments_type ON crm_company_type_assignments(type_id);

-- Enable RLS
ALTER TABLE crm_company_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_company_type_assignments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (admin enforcement at app level)
CREATE POLICY "Allow authenticated access to crm_company_types"
  ON crm_company_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access to crm_company_type_assignments"
  ON crm_company_type_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
