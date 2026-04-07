import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Get enabled modules for an organization
 *
 * Wrapped with React.cache() to deduplicate within a single request.
 */
export const getOrgEnabledModules = cache(async (
  organizationId: string | null
): Promise<Set<string>> => {
  if (!organizationId) {
    return new Set();
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data: orgModules } = await client
    .from("organization_modules")
    .select("module_code")
    .eq("organization_id", organizationId)
    .eq("enabled", true);

  return new Set(
    (orgModules || []).map((m: { module_code: string }) => m.module_code)
  );
});

/**
 * Check if an organization has a specific module enabled
 */
export async function orgHasModule(
  organizationId: string | null,
  moduleCode: string
): Promise<boolean> {
  const modules = await getOrgEnabledModules(organizationId);
  return modules.has(moduleCode);
}

/**
 * Get enabled modules for a user within an organization
 *
 * Returns the intersection of org-level and user-level enabled modules.
 * Wrapped with React.cache() to deduplicate within a single request.
 */
export const getUserEnabledModules = cache(async (
  userId: string,
  organizationId: string | null
): Promise<Set<string>> => {
  if (!organizationId || !userId) {
    return new Set();
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Fetch org modules and user modules in parallel
  const [orgResult, userResult] = await Promise.all([
    client
      .from("organization_modules")
      .select("module_code")
      .eq("organization_id", organizationId)
      .eq("enabled", true),
    client
      .from("user_modules")
      .select("module_code")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("enabled", true),
  ]);

  const orgModules = new Set(
    (orgResult.data || []).map((m: { module_code: string }) => m.module_code)
  );

  // Intersection: user has it AND org has it
  const effectiveModules = new Set<string>();
  (userResult.data || []).forEach((m: { module_code: string }) => {
    if (orgModules.has(m.module_code)) {
      effectiveModules.add(m.module_code);
    }
  });

  return effectiveModules;
});
