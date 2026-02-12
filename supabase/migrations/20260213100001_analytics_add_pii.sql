-- Add PII fields to analytics_sessions
-- IP address and User ID for enhanced tracking

ALTER TABLE analytics_sessions
ADD COLUMN ip_address TEXT,
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for user lookups
CREATE INDEX idx_analytics_sessions_user_id ON analytics_sessions(user_id);
CREATE INDEX idx_analytics_sessions_ip_address ON analytics_sessions(ip_address);

-- Add comment for documentation
COMMENT ON COLUMN analytics_sessions.ip_address IS 'Visitor IP address from x-forwarded-for header';
COMMENT ON COLUMN analytics_sessions.user_id IS 'Authenticated user ID if logged in (from portal)';
