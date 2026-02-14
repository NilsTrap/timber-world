-- CRM Tables for Lead Generation POC
-- Created: 2026-02-14

-- Companies table
CREATE TABLE crm_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_number TEXT,
  website TEXT,
  country TEXT,
  city TEXT,
  address TEXT,
  postal_code TEXT,
  founded_year INTEGER,
  employees INTEGER,
  turnover_eur INTEGER,
  industry TEXT,
  industry_codes TEXT[],
  email TEXT,
  phone TEXT,
  source TEXT,
  source_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'researching', 'contacted', 'customer', 'rejected', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts table (people)
CREATE TABLE crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES crm_companies(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  position TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  source TEXT,
  -- GDPR compliance fields
  consent_status TEXT DEFAULT 'pending' CHECK (consent_status IN ('pending', 'subscribed', 'unsubscribed')),
  consent_date TIMESTAMPTZ,
  unsubscribe_date TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  data_request_date TIMESTAMPTZ,
  deletion_requested BOOLEAN DEFAULT FALSE,
  last_contacted TIMESTAMPTZ,
  do_not_contact BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_crm_companies_status ON crm_companies(status);
CREATE INDEX idx_crm_companies_country ON crm_companies(country);
CREATE INDEX idx_crm_companies_name ON crm_companies(name);
CREATE INDEX idx_crm_contacts_company_id ON crm_contacts(company_id);
CREATE INDEX idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX idx_crm_contacts_consent_status ON crm_contacts(consent_status);

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_crm_companies_updated_at
  BEFORE UPDATE ON crm_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_contacts_updated_at
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
-- Note: Admin-only access is enforced at application level (isAdmin check in pages)
ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access to CRM
CREATE POLICY "Allow authenticated access to crm_companies"
  ON crm_companies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated access to crm_contacts"
  ON crm_contacts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
