-- Drop and recreate quote_requests table with correct schema
DROP TABLE IF EXISTS quote_requests CASCADE;

CREATE TABLE quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  product TEXT,
  species TEXT,
  type TEXT,
  quality TEXT,
  humidity TEXT,
  thickness TEXT,
  width TEXT,
  length TEXT,
  pieces TEXT,
  notes TEXT,
  selected_product_ids TEXT[],
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_quote_requests_status ON quote_requests(status);
CREATE INDEX idx_quote_requests_created_at ON quote_requests(created_at DESC);

-- Enable RLS
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public insert" ON quote_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read" ON quote_requests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated update" ON quote_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE quote_requests IS 'Stores quote form submissions from the marketing website';
