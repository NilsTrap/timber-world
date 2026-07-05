-- Epic T / T1 (short-id a7xy5q) — per-user MCP API keys.
--
-- A user-scoped MCP credential. The plaintext key is shown ONCE at issue and is
-- NEVER stored: only its sha256 hex digest (key_hash) lives here. The MCP route
-- (apps/portal/src/app/api/timber-mcp/route.ts) resolves an incoming bearer by
-- sha256-hashing it and looking up a non-revoked row here via the service-role
-- admin client — then mints a short-lived user JWT (sub = portal_users.auth_user_id)
-- so RLS applies the SAME walls as that user's portal login. A per-user key can
-- therefore never exceed its owner's portal permissions.
--
-- organisation_id (nullable) is the key's DEFAULT org pin (context for audit +
-- module checks); when null the route falls back to a per-call org_id arg, else
-- the user's primary membership. Row-level data access is NOT governed by this
-- column — it comes from the user JWT's RLS.
--
-- RLS: platform-admin only (read/write). Inserts/lookups from the route use the
-- service-role client (bypasses RLS), so RLS here is a backstop against any
-- authenticated (anon-key) reach. NEVER expose key_hash to a non-admin path.

CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id  UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  key_hash        TEXT NOT NULL UNIQUE,            -- sha256 hex of the plaintext key (unique index = the lookup index)
  label           TEXT,
  organisation_id UUID REFERENCES public.organisations(id),  -- nullable default org pin
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ
);

-- The UNIQUE constraint on key_hash already provides the btree lookup index used
-- by the route's per-request resolution. An index on the owner speeds the admin
-- "list this person's keys" query.
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_portal_user
  ON public.mcp_api_keys (portal_user_id);

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

-- Platform-admin only for every operation (SELECT/INSERT/UPDATE/DELETE). The
-- route uses the service-role client which bypasses RLS; this policy is a
-- backstop so a plain authenticated session can never read hashes or mint keys.
DROP POLICY IF EXISTS mcp_api_keys_admin_all ON public.mcp_api_keys;
CREATE POLICY mcp_api_keys_admin_all
  ON public.mcp_api_keys
  FOR ALL
  TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

NOTIFY pgrst, 'reload schema';
