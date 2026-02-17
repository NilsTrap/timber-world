-- Trading Partners: Controls which organisations can see each other in shipment dropdowns
-- An organisation can only create shipments to/from their trading partners

CREATE TABLE organisation_trading_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  partner_organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Prevent duplicate partnerships
  CONSTRAINT unique_trading_partner UNIQUE (organisation_id, partner_organisation_id),
  -- Prevent self-partnerships
  CONSTRAINT no_self_partner CHECK (organisation_id != partner_organisation_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_trading_partners_org ON organisation_trading_partners(organisation_id);
CREATE INDEX idx_trading_partners_partner ON organisation_trading_partners(partner_organisation_id);

-- RLS policies
ALTER TABLE organisation_trading_partners ENABLE ROW LEVEL SECURITY;

-- Admins can manage all trading partners
CREATE POLICY "Admins can manage trading partners"
  ON organisation_trading_partners
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'platform_admin')
    )
  );

-- Users can view their own organisation's trading partners
CREATE POLICY "Users can view own trading partners"
  ON organisation_trading_partners
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE organisation_trading_partners IS 'Defines which organisations can see each other in shipment dropdowns';
COMMENT ON COLUMN organisation_trading_partners.organisation_id IS 'The organisation that can see the partner';
COMMENT ON COLUMN organisation_trading_partners.partner_organisation_id IS 'The partner organisation that will appear in dropdowns';
