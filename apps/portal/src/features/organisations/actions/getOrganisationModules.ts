"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Organization Module Configuration
 */
export interface OrganisationModule {
  moduleCode: string;
  moduleName: string;
  moduleDescription: string | null;
  category: string;
  enabled: boolean;
}

/**
 * Get organization's module configuration
 */
export async function getOrganisationModules(
  organisationId: string
): Promise<ActionResult<OrganisationModule[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Get all features (master list)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: featuresData, error: featuresError } = await (supabase as any)
    .from("features")
    .select("code, name, description, category, sort_order")
    .order("category")
    .order("sort_order");

  if (featuresError) {
    console.error("Failed to fetch modules:", featuresError);
    return { success: false, error: "Failed to fetch modules", code: "QUERY_FAILED" };
  }

  // Get organization's enabled modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgModulesData, error: orgModulesError } = await (supabase as any)
    .from("organization_modules")
    .select("module_code, enabled")
    .eq("organization_id", organisationId);

  if (orgModulesError) {
    console.error("Failed to fetch org modules:", orgModulesError);
    return { success: false, error: "Failed to fetch organization modules", code: "QUERY_FAILED" };
  }

  // Create map of enabled modules
  const enabledMap = new Map<string, boolean>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (orgModulesData || []).forEach((om: any) => {
    enabledMap.set(om.module_code, om.enabled);
  });

  // Merge with enabled status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modules: OrganisationModule[] = (featuresData || []).map((f: any) => ({
    moduleCode: f.code,
    moduleName: f.name,
    moduleDescription: f.description,
    category: f.category || "Other",
    enabled: enabledMap.get(f.code) ?? false,
  }));

  return { success: true, data: modules };
}

/**
 * Update organization's module configuration
 */
export async function updateOrganisationModules(
  organisationId: string,
  moduleCodes: string[]
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Delete existing module configuration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("organization_modules")
    .delete()
    .eq("organization_id", organisationId);

  if (deleteError) {
    console.error("Failed to delete org modules:", deleteError);
    return { success: false, error: "Failed to update modules", code: "DELETE_FAILED" };
  }

  // Insert new module configuration
  if (moduleCodes.length > 0) {
    const modules = moduleCodes.map((code) => ({
      organization_id: organisationId,
      module_code: code,
      enabled: true,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("organization_modules")
      .insert(modules);

    if (insertError) {
      console.error("Failed to insert org modules:", insertError);
      return { success: false, error: "Failed to update modules", code: "INSERT_FAILED" };
    }
  }

  return { success: true, data: undefined };
}
