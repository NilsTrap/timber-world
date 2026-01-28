-- Fix: Change auth_user_id foreign key from ON DELETE CASCADE to ON DELETE SET NULL
--
-- Problem: When resending user invitations, the old auth user is deleted and a new one created.
-- With ON DELETE CASCADE, deleting the auth user also deletes the portal_user row.
-- This causes users to disappear from the admin user list.
--
-- Solution: Use ON DELETE SET NULL so the portal_user row is preserved when auth user is deleted.

-- Drop the existing foreign key constraint
ALTER TABLE portal_users
DROP CONSTRAINT IF EXISTS portal_users_auth_user_id_fkey;

-- Re-add the constraint with ON DELETE SET NULL
ALTER TABLE portal_users
ADD CONSTRAINT portal_users_auth_user_id_fkey
FOREIGN KEY (auth_user_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;
