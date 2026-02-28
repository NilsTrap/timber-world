-- CRM Keywords table
-- Keywords that can be assigned to companies for categorization

CREATE TABLE IF NOT EXISTS crm_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_crm_keywords_name ON crm_keywords(name);

-- Seed initial keywords
INSERT INTO crm_keywords (name) VALUES
  ('steps'),
  ('stairs'),
  ('risers'),
  ('staircases'),
  ('handrails')
ON CONFLICT (name) DO NOTHING;

-- Company-Keywords junction table (for later use)
CREATE TABLE IF NOT EXISTS crm_company_keywords (
  company_id UUID NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES crm_keywords(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, keyword_id)
);

-- Indexes for the junction table
CREATE INDEX idx_crm_company_keywords_company ON crm_company_keywords(company_id);
CREATE INDEX idx_crm_company_keywords_keyword ON crm_company_keywords(keyword_id);
