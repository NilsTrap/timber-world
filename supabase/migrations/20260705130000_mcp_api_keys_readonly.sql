-- Epic T / T2 (short-id uh5kdj) — per-user MCP key read-only flag (MEDIUM-3).
--
-- Adds an OPTIONAL read-only scope to a per-user MCP key. When true, the MCP route
-- resolves the key to role="readonly" so the existing full/readonly filter blocks
-- EVERY write tool — regardless of the owner's portal permissions. A read-only key
-- is the smallest blast radius for a chat/agent integration that only needs to read
-- (prompt-injection containment), independent of the owner's own write rights.
--
-- Additive + idempotent: NOT NULL DEFAULT false, so every existing key stays a
-- full-scope key (unchanged behaviour). RLS is unchanged (admin-only), and the route
-- reads this column via the service-role client during key resolution.

ALTER TABLE public.mcp_api_keys
  ADD COLUMN IF NOT EXISTS is_readonly BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mcp_api_keys.is_readonly IS
  'T2: when true the key resolves to role=readonly (read tools only), independent of the owner''s write permissions.';

NOTIFY pgrst, 'reload schema';
