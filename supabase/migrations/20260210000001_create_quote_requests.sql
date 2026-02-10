-- Create quote_requests table to store all quote form submissions
CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact information
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  phone TEXT,

  -- Product specifications
  product TEXT,
  species TEXT,
  type TEXT,
  quality TEXT,
  humidity TEXT,
  thickness TEXT,
  width TEXT,
  length TEXT,
  pieces TEXT,

  -- Additional info
  notes TEXT,

  -- Selected product IDs (if coming from catalog)
  selected_product_ids TEXT[],

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'new',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_quote_requests_status ON quote_requests(status);
CREATE INDEX idx_quote_requests_created_at ON quote_requests(created_at DESC);

-- Enable RLS
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert from anyone (public form submission)
CREATE POLICY "Allow public insert" ON quote_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Allow read for authenticated users (admin dashboard)
CREATE POLICY "Allow authenticated read" ON quote_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow update for authenticated users (status changes)
CREATE POLICY "Allow authenticated update" ON quote_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE quote_requests IS 'Stores all quote form submissions from the marketing website';
