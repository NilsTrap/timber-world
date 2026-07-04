/**
 * Supabase User-Scoped Client for Portal (Epic T / T1)
 * Re-exports from @timber/database for convenience.
 *
 * RLS-RESPECTING: uses the anon key + a minted user JWT (Authorization bearer),
 * so PostgREST runs queries as that user and RLS applies their portal walls.
 * Pass a MINTED USER JWT — never the anon or service-role key. Used only by the
 * MCP route's per-user-key path.
 */
export { createUserScopedClient } from "@timber/database";
