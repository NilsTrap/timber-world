-- Clean up auth user_metadata: update "producer" role to "user"
-- The portal_users table is the source of truth for roles,
-- but we should keep auth metadata consistent to avoid confusion.

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "user"}'::jsonb
WHERE raw_user_meta_data->>'role' = 'producer';
