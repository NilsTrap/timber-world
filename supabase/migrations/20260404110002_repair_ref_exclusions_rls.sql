-- Repair: add RLS policies that failed in previous migration due to wrong column name

-- Drop policies if they partially exist
DROP POLICY IF EXISTS "admin_full_access" ON organisation_ref_exclusions;
DROP POLICY IF EXISTS "org_users_read_own" ON organisation_ref_exclusions;

-- Ensure RLS is enabled
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
