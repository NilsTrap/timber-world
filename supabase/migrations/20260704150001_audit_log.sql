-- Q5.2 (short-id 9fvsew) — platform-wide action audit log.
-- One row per audited mutation (identity / access / catalog / settings writes),
-- tagged human-vs-service so a Vilma/MCP write is distinguishable from a person's.
-- Rows are inserted via the service-role admin client (RLS-bypassing) from the
-- logAudit helper; RLS below only governs authenticated SELECT reads
-- (platform-admin only, mirroring login_events).
--
-- NEVER store secrets here (passwords, tokens): the password-set/reset actions
-- audit the EVENT only. metadata is a small JSONB describe-what-happened blob.

CREATE TABLE IF NOT EXISTS public.action_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT,
  organisation_id UUID,
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('human', 'service')),
  actor_user_id   UUID,
  actor_label     TEXT,
  metadata        JSONB,
  ip              TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_audit_log_created
  ON public.action_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_audit_log_resource
  ON public.action_audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_action_audit_log_actor
  ON public.action_audit_log (actor_user_id);

ALTER TABLE public.action_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT is platform-admin only. Inserts use the service-role client (bypasses
-- RLS), so no INSERT policy is needed.
DROP POLICY IF EXISTS action_audit_log_select_admin ON public.action_audit_log;
CREATE POLICY action_audit_log_select_admin
  ON public.action_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_platform_admin());

NOTIFY pgrst, 'reload schema';
