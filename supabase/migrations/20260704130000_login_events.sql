-- Q5.1 (short-id 9fvsew) — login history.
-- Per-person login event log (history of successful logins). Complements
-- portal_users.last_login_at (which only holds the most-recent login).
-- Rows are inserted via the service-role admin client (RLS-bypassing) from the
-- login write path; RLS below only governs authenticated SELECT reads.

CREATE TABLE IF NOT EXISTS public.login_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID REFERENCES public.portal_users(id) ON DELETE CASCADE,
  email          TEXT,
  ip             TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user_created
  ON public.login_events (portal_user_id, created_at DESC);

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

-- SELECT is platform-admin only. Inserts use the service-role client (bypasses
-- RLS), so no INSERT policy is needed.
DROP POLICY IF EXISTS login_events_select_admin ON public.login_events;
CREATE POLICY login_events_select_admin
  ON public.login_events
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_platform_admin());

NOTIFY pgrst, 'reload schema';
