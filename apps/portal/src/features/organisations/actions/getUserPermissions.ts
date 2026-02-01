"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Permission Override State
 */
export type OverrideState = "inherit" | "grant" | "deny";

/**
 * User Permission with Override
 */
export interface UserPermission {
  featureCode: string;
  featureName: string;
  featureDescription: string | null;
  category: string;
  fromRoles: boolean;
  override: OverrideState;
}

/**
 * Get user's permissions with override status
 */
export async function getUserPermissions(
  userId: string,
  organisationId: string
): Promise<ActionResult<UserPermission[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Get all features
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: featuresData, error: featuresError } = await (supabase as any)
    .from("features")
    .select("code, name, description, category, sort_order")
    .order("category")
    .order("sort_order");

  if (featuresError) {
    console.error("Failed to fetch features:", featuresError);
    return { success: false, error: "Failed to fetch features", code: "QUERY_FAILED" };
  }

  // Get user's roles and their permissions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRolesData, error: userRolesError } = await (supabase as any)
    .from("user_roles")
    .select("roles(permissions)")
    .eq("user_id", userId)
    .eq("organization_id", organisationId);

  if (userRolesError) {
    console.error("Failed to fetch user roles:", userRolesError);
    return { success: false, error: "Failed to fetch user roles", code: "QUERY_FAILED" };
  }

  // Collect all permissions from roles
  const rolePermissions = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (userRolesData || []).forEach((ur: any) => {
    const perms = ur.roles?.permissions || [];
    perms.forEach((p: string) => {
      if (p === "*") {
        // Wildcard - add all features
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (featuresData || []).forEach((f: any) => rolePermissions.add(f.code));
      } else if (p.endsWith(".*")) {
        // Category wildcard
        const category = p.replace(".*", "");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (featuresData || []).forEach((f: any) => {
          if (f.code.startsWith(category + ".")) {
            rolePermissions.add(f.code);
          }
        });
      } else {
        rolePermissions.add(p);
      }
    });
  });

  // Get user's permission overrides
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: overridesData, error: overridesError } = await (supabase as any)
    .from("user_permission_overrides")
    .select("feature_code, granted")
    .eq("user_id", userId)
    .eq("organization_id", organisationId);

  if (overridesError) {
    console.error("Failed to fetch overrides:", overridesError);
    return { success: false, error: "Failed to fetch permission overrides", code: "QUERY_FAILED" };
  }

  // Create map of overrides
  const overridesMap = new Map<string, boolean>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (overridesData || []).forEach((o: any) => {
    overridesMap.set(o.feature_code, o.granted);
  });

  // Merge features with permissions and overrides
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permissions: UserPermission[] = (featuresData || []).map((f: any) => {
    let override: OverrideState = "inherit";
    if (overridesMap.has(f.code)) {
      override = overridesMap.get(f.code) ? "grant" : "deny";
    }

    return {
      featureCode: f.code,
      featureName: f.name,
      featureDescription: f.description,
      category: f.category || "Other",
      fromRoles: rolePermissions.has(f.code),
      override,
    };
  });

  return { success: true, data: permissions };
}

/**
 * Update user's permission overrides
 */
export async function updateUserPermissions(
  userId: string,
  organisationId: string,
  overrides: Array<{ featureCode: string; state: OverrideState }>
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Delete existing overrides
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("user_permission_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", organisationId);

  if (deleteError) {
    console.error("Failed to delete permission overrides:", deleteError);
    return { success: false, error: "Failed to update permissions", code: "DELETE_FAILED" };
  }

  // Insert new overrides (only non-inherit states)
  const newOverrides = overrides
    .filter((o) => o.state !== "inherit")
    .map((o) => ({
      user_id: userId,
      organization_id: organisationId,
      feature_code: o.featureCode,
      granted: o.state === "grant",
    }));

  if (newOverrides.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("user_permission_overrides")
      .insert(newOverrides);

    if (insertError) {
      console.error("Failed to insert permission overrides:", insertError);
      return { success: false, error: "Failed to update permissions", code: "INSERT_FAILED" };
    }
  }

  return { success: true, data: undefined };
}
