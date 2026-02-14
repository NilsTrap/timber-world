/**
 * CRM-specific Supabase helper
 *
 * This is a temporary workaround until we regenerate Supabase types
 * to include the new crm_companies and crm_contacts tables.
 */
import { createAdminClient } from "@timber/database";

/**
 * Creates a Supabase client for CRM operations
 * Uses the admin client which has looser type checking for new tables
 */
export async function createCrmClient() {
  // The admin client bypasses RLS, which is fine since we check isAdmin in pages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}
