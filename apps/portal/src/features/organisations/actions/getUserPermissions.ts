"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * User Module Configuration
 */
export interface UserModule {
  moduleCode: string;
  moduleName: string;
  moduleDescription: string | null;
  category: string;
  orgEnabled: boolean;
  userEnabled: boolean;
}

/**
 * Get user's module configuration within an organization
 *
 * Returns all modules with their org-level and user-level enabled status.
 * A module is only effective if both org AND user have it enabled.
 */
export async function getUserModules(
  userId: string,
  organisationId: string
): Promise<ActionResult<UserModule[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Get all modules (master list)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: modulesData, error: modulesError } = await (supabase as any)
    .from("modules")
    .select("code, name, description, category, sort_order")
    .order("category")
    .order("sort_order");

  if (modulesError) {
    console.error("Failed to fetch modules:", modulesError);
    return { success: false, error: "Failed to fetch modules", code: "QUERY_FAILED" };
  }

  // Get org's enabled modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgModulesData } = await (supabase as any)
    .from("organization_modules")
    .select("module_code, enabled")
    .eq("organization_id", organisationId);

  const orgModuleMap = new Map<string, boolean>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (orgModulesData || []).forEach((m: any) => {
    orgModuleMap.set(m.module_code, m.enabled);
  });

  // Get user's enabled modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userModulesData } = await (supabase as any)
    .from("user_modules")
    .select("module_code, enabled")
    .eq("user_id", userId)
    .eq("organization_id", organisationId);

  const userModuleMap = new Map<string, boolean>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (userModulesData || []).forEach((m: any) => {
    userModuleMap.set(m.module_code, m.enabled);
  });

  // Merge into result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modules: UserModule[] = (modulesData || []).map((m: any) => ({
    moduleCode: m.code,
    moduleName: m.name,
    moduleDescription: m.description,
    category: m.category || "Other",
    orgEnabled: orgModuleMap.get(m.code) ?? false,
    userEnabled: userModuleMap.get(m.code) ?? false,
  }));

  return { success: true, data: modules };
}

/**
 * Update user's module configuration within an organization
 *
 * Sets which modules are enabled for this specific user.
 */
export async function updateUserModules(
  userId: string,
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

  // Delete existing user modules for this user+org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("user_modules")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", organisationId);

  if (deleteError) {
    console.error("Failed to delete user modules:", deleteError);
    return { success: false, error: "Failed to update user modules", code: "DELETE_FAILED" };
  }

  // Insert new module configuration
  if (moduleCodes.length > 0) {
    const modules = moduleCodes.map((code) => ({
      user_id: userId,
      organization_id: organisationId,
      module_code: code,
      enabled: true,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("user_modules")
      .insert(modules);

    if (insertError) {
      console.error("Failed to insert user modules:", insertError);
      return { success: false, error: "Failed to update user modules", code: "INSERT_FAILED" };
    }
  }

  return { success: true, data: undefined };
}

// Legacy exports for backward compatibility during transition
export type OverrideState = "inherit" | "grant" | "deny";
export interface UserPermission {
  moduleCode: string;
  moduleName: string;
  moduleDescription: string | null;
  category: string;
  fromRoles: boolean;
  override: OverrideState;
}
export const getUserPermissions = getUserModules;
export const updateUserPermissions = updateUserModules;
