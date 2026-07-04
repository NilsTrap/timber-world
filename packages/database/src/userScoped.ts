/**
 * Supabase User-Scoped Client (Epic T / T1)
 *
 * The RLS-RESPECTING counterpart of createAdminClient(). It uses the public anon
 * key (never the service-role key) and pins the caller's identity by sending a
 * minted user JWT as the Authorization bearer on every request. PostgREST runs
 * each query as that authenticated user, so RLS applies exactly the user's walls
 * — no RLS bypass.
 *
 * Used by the MCP route's per-user-key path. Cookie-free and stateless
 * (persistSession / autoRefreshToken off); the token is request-scoped.
 *
 * SECURITY: pass a MINTED USER JWT here — never the anon key alone, never the
 * service-role key. Construct the (client, actor) pair atomically at the call
 * site so a user identity is never paired with a mismatched actor.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

export function createUserScopedClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables for user-scoped client. ' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    )
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
