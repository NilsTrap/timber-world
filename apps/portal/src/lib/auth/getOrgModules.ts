import { createClient } from "@/lib/supabase/server";

/**
 * Get enabled modules for an organization
 *
 * Lightweight function to fetch which modules are enabled for a specific organization.
 * Used primarily for filtering navigation items in the sidebar.
 *
 * @param organizationId - Organization ID to check modules for
 * @returns Set of enabled module codes
 */
export async function getOrgEnabledModules(
  organizationId: string | null
): Promise<Set<string>> {
  if (!organizationId) {
    return new Set();
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Get explicitly enabled modules
  const { data: orgModules } = await client
    .from("organization_modules")
    .select("module_code, enabled")
    .eq("organization_id", organizationId);

  const enabledModules = new Set<string>();

  // Track explicitly enabled modules
  (orgModules || []).forEach((m: { module_code: string; enabled: boolean }) => {
    if (m.enabled) {
      enabledModules.add(m.module_code);
    }
  });

  return enabledModules;
}

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
