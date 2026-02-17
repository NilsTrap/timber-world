-- Fix RLS policy for trading partners to match app's admin check
-- The app considers users with role='admin' in portal_users as admins

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage trading partners" ON organisation_trading_partners;
DROP POLICY IF EXISTS "Users can view own trading partners" ON organisation_trading_partners;

-- New policy: Platform admins (is_platform_admin = true in portal_users) can manage all
CREATE POLICY "Platform admins can manage trading partners"
  ON organisation_trading_partners
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portal_users pu
      WHERE pu.auth_user_id = auth.uid()
      AND pu.is_platform_admin = true
    )
  );

-- Users can view trading partners for their own organisation
CREATE POLICY "Users can view own org trading partners"
  ON organisation_trading_partners
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT pu.organisation_id FROM portal_users pu
      WHERE pu.auth_user_id = auth.uid()
    )
  );
