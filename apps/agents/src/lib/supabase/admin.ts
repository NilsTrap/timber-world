import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Server-only. Used for agent self-signup
 * (creating the auth user + pending profile). Never import from client code.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
