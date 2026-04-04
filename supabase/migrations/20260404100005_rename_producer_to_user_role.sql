-- Drop old constraint, rename data, add new constraint
ALTER TABLE portal_users DROP CONSTRAINT portal_users_role_check;
UPDATE portal_users SET role = 'user' WHERE role = 'producer';
ALTER TABLE portal_users ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE portal_users ADD CONSTRAINT portal_users_role_check CHECK (role IN ('admin', 'user'));
