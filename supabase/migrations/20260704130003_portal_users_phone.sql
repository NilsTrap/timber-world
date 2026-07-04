-- Q4 · person profile editing needs a phone number.
-- portal_users has name/email but no phone; add it (nullable, additive, idempotent).
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN portal_users.phone IS 'Optional contact phone for the person (Q4 profile editing).';
