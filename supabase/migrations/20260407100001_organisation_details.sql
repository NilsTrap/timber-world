-- Add shipment document fields to organisations
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS legal_address TEXT,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS registration_number TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Delivery addresses (1-2 per org, selectable when creating shipment docs)
CREATE TABLE IF NOT EXISTS organisation_delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Default',
  address TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_hours TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_delivery_addresses_org
  ON organisation_delivery_addresses(organisation_id);

-- Auto-update updated_at trigger
CREATE TRIGGER set_updated_at_org_delivery_addresses
  BEFORE UPDATE ON organisation_delivery_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Allow authenticated access (no RLS needed - admin-only via app logic)
ALTER TABLE organisation_delivery_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to organisation_delivery_addresses"
  ON organisation_delivery_addresses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
