-- Allow admin users to insert, update, and delete staircase pricing rows
CREATE POLICY "Allow admin write" ON uk_staircase_pricing
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
