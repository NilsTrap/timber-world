-- Per-organisation reference data filtering
-- Stores which reference values are EXCLUDED (hidden) for each organisation.
-- If no row exists for a (org, table, value), the value is visible (opt-out model).

CREATE TABLE organisation_ref_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ref_table TEXT NOT NULL,
  ref_value_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organisation_id, ref_table, ref_value_id)
);

-- Index for fast lookups by organisation
CREATE INDEX idx_org_ref_exclusions_org ON organisation_ref_exclusions(organisation_id);

-- Index for fast lookups by org + table (used when fetching dropdowns)
CREATE INDEX idx_org_ref_exclusions_org_table ON organisation_ref_exclusions(organisation_id, ref_table);

-- RLS
ALTER TABLE organisation_ref_exclusions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_full_access" ON organisation_ref_exclusions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM portal_users
      WHERE portal_users.auth_user_id = auth.uid()
      AND portal_users.role = 'admin'
    )
  );

-- Org users can read their own exclusions
CREATE POLICY "org_users_read_own" ON organisation_ref_exclusions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portal_users
      WHERE portal_users.auth_user_id = auth.uid()
      AND portal_users.organisation_id = organisation_ref_exclusions.organisation_id
    )
  );
