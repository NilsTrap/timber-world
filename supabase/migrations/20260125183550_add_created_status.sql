-- =============================================
-- Add 'created' status to portal_users
-- Migration: 20260125183550_add_created_status.sql
-- Story: 7.3 - User Credential Generation (status flow update)
-- =============================================

-- Status flow: created → invited → active
-- - created: User record exists but no credentials sent yet
-- - invited: Credentials have been sent, user can log in
-- - active: User has logged in at least once

-- =============================================
-- 0. ENSURE STATUS COLUMN EXISTS
-- =============================================
-- Defensive: the column is also added by a later migration
-- (20260126000004_extend_portal_users.sql) using ADD COLUMN IF NOT EXISTS,
-- so adding it here too is safe. Production was set up with the column
-- present at this point in the history; fresh DBs (staging, future
-- branches) need this guard to apply the migration cleanly.
ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'invited';

-- =============================================
-- 1. UPDATE STATUS CHECK CONSTRAINT
-- =============================================

-- Drop existing constraint
ALTER TABLE portal_users
  DROP CONSTRAINT IF EXISTS portal_users_status_check;

-- Add new constraint with 'created' status
ALTER TABLE portal_users
  ADD CONSTRAINT portal_users_status_check
    CHECK (status IN ('created', 'invited', 'active'));

-- =============================================
-- 2. UPDATE DEFAULT STATUS TO 'created'
-- =============================================

ALTER TABLE portal_users
  ALTER COLUMN status SET DEFAULT 'created';

-- =============================================
-- 3. UPDATE EXISTING USERS
-- =============================================

-- Users with auth_user_id but status='invited' are actually active
-- (they were created before this migration)
-- Keep them as 'invited' or 'active' - don't change to 'created'

-- Users without auth_user_id and status='invited' should be 'created'
-- (they haven't received credentials yet)
UPDATE portal_users
SET status = 'created'
WHERE auth_user_id IS NULL
  AND status = 'invited';

-- =============================================
-- 4. UPDATE COMMENT
-- =============================================

COMMENT ON COLUMN portal_users.status IS
  'User lifecycle: created (pending credentials), invited (credentials sent), or active (has logged in)';
