-- Repair quote_requests table (in case previous migration failed partially)

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS quote_requests (
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

-- Add missing columns if table exists but columns don't
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'company') THEN
    ALTER TABLE quote_requests ADD COLUMN company TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'phone') THEN
    ALTER TABLE quote_requests ADD COLUMN phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'product') THEN
    ALTER TABLE quote_requests ADD COLUMN product TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'species') THEN
    ALTER TABLE quote_requests ADD COLUMN species TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'type') THEN
    ALTER TABLE quote_requests ADD COLUMN type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'quality') THEN
    ALTER TABLE quote_requests ADD COLUMN quality TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'humidity') THEN
    ALTER TABLE quote_requests ADD COLUMN humidity TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'thickness') THEN
    ALTER TABLE quote_requests ADD COLUMN thickness TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'width') THEN
    ALTER TABLE quote_requests ADD COLUMN width TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'length') THEN
    ALTER TABLE quote_requests ADD COLUMN length TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'pieces') THEN
    ALTER TABLE quote_requests ADD COLUMN pieces TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'notes') THEN
    ALTER TABLE quote_requests ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_requests' AND column_name = 'selected_product_ids') THEN
    ALTER TABLE quote_requests ADD COLUMN selected_product_ids TEXT[];
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON quote_requests(created_at DESC);

-- Enable RLS
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Allow public insert" ON quote_requests;
DROP POLICY IF EXISTS "Allow authenticated read" ON quote_requests;
DROP POLICY IF EXISTS "Allow authenticated update" ON quote_requests;

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
