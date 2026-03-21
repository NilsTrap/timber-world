-- CRM Industries table
-- Industry categories that can be assigned to companies for classification

CREATE TABLE IF NOT EXISTS crm_industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_industries_name ON crm_industries(name);

-- Seed initial industry categories
INSERT INTO crm_industries (name) VALUES
  ('Joinery'),
  ('Windows & Doors'),
  ('Kitchens'),
  ('Furniture'),
  ('Oak Frames'),
  ('Staircases'),
  ('Sawmills'),
  ('Flooring'),
  ('Timber Frame')
ON CONFLICT (name) DO NOTHING;

-- Company-Industries junction table
CREATE TABLE IF NOT EXISTS crm_company_industries (
  company_id UUID NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
  industry_id UUID NOT NULL REFERENCES crm_industries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, industry_id)
);

CREATE INDEX idx_crm_company_industries_company ON crm_company_industries(company_id);
CREATE INDEX idx_crm_company_industries_industry ON crm_company_industries(industry_id);

-- Enable RLS
ALTER TABLE crm_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_company_industries ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (admin enforcement at app level)
CREATE POLICY "Allow authenticated access to crm_industries"
  ON crm_industries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access to crm_company_industries"
  ON crm_company_industries FOR ALL TO authenticated USING (true) WITH CHECK (true);
