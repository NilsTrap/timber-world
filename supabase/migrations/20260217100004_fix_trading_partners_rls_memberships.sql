-- Fix RLS policy for trading partners to support organization_memberships (Epic 10)
-- Users can now belong to orgs via organization_memberships, not just portal_users.organisation_id

-- Drop existing user policy
DROP POLICY IF EXISTS "Users can view own org trading partners" ON organisation_trading_partners;

-- New policy: Users can view trading partners for any org they're a member of
-- Checks both portal_users.organisation_id (legacy) AND organization_memberships
CREATE POLICY "Users can view own org trading partners"
  ON organisation_trading_partners
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      -- Legacy: portal_users.organisation_id
      SELECT pu.organisation_id FROM portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      AND pu.organisation_id IS NOT NULL
      UNION
      -- Epic 10: organization_memberships
      SELECT om.organization_id FROM organization_memberships om
      JOIN portal_users pu ON pu.id = om.user_id
      WHERE pu.auth_user_id = auth.uid()
      AND om.is_active = true
    )
  );
