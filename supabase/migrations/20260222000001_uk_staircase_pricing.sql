-- UK Staircase Pricing Table
-- Stores pricing data for UK staircase components with dimensions, costs, and GBP calculations

CREATE TABLE uk_staircase_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('FJ', 'FS', 'FJFS')),
  thickness_mm INTEGER NOT NULL,
  width_mm INTEGER NOT NULL,
  riser_mm INTEGER,
  length_mm INTEGER NOT NULL,
  eur_per_m3_cents INTEGER NOT NULL,
  work_cost_cents INTEGER NOT NULL DEFAULT 0,
  transport_cost_cents INTEGER NOT NULL DEFAULT 0,
  gbp_rate INTEGER NOT NULL DEFAULT 9000,  -- 9000 = 0.90
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_uk_staircase_pricing_active ON uk_staircase_pricing (is_active, sort_order);
CREATE INDEX idx_uk_staircase_pricing_code ON uk_staircase_pricing (code);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_uk_staircase_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER uk_staircase_pricing_updated_at
  BEFORE UPDATE ON uk_staircase_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_uk_staircase_pricing_updated_at();

-- RLS policies (admin only for now)
ALTER TABLE uk_staircase_pricing ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (for portal display)
CREATE POLICY "Allow authenticated read" ON uk_staircase_pricing
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role full access (for admin operations)
CREATE POLICY "Allow service role full access" ON uk_staircase_pricing
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Reload PostgREST cache
NOTIFY pgrst, 'reload config';
