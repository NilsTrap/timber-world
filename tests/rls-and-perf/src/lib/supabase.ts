import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, type TestUserDef } from "../config.js";

export function adminClient(): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Sign-in as a specific test user. Returns a client whose subsequent queries
 * carry that user's auth token — RLS is evaluated against that user.
 */
export async function userClient(user: TestUserDef): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) {
    throw new Error(`Sign-in failed for ${user.email}: ${error.message}`);
  }
  return client;
}
