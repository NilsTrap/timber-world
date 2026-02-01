"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * User Role Assignment
 */
export interface UserRoleAssignment {
  roleId: string;
  roleName: string;
  roleDescription: string | null;
  isSystem: boolean;
  assigned: boolean;
}

/**
 * Get user's role assignments within an organization
 */
export async function getUserRoles(
  userId: string,
  organisationId: string
): Promise<ActionResult<UserRoleAssignment[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Get all roles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rolesData, error: rolesError } = await (supabase as any)
    .from("roles")
    .select("id, name, description, is_system")
    .order("name");

  if (rolesError) {
    console.error("Failed to fetch roles:", rolesError);
    return { success: false, error: "Failed to fetch roles", code: "QUERY_FAILED" };
  }

  // Get user's assigned roles for this organization
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRolesData, error: userRolesError } = await (supabase as any)
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId)
    .eq("organization_id", organisationId);

  if (userRolesError) {
    console.error("Failed to fetch user roles:", userRolesError);
    return { success: false, error: "Failed to fetch user roles", code: "QUERY_FAILED" };
  }

  // Create set of assigned role IDs
  const assignedRoleIds = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (userRolesData || []).forEach((ur: any) => {
    assignedRoleIds.add(ur.role_id);
  });

  // Merge roles with assignment status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roles: UserRoleAssignment[] = (rolesData || []).map((r: any) => ({
    roleId: r.id,
    roleName: r.name,
    roleDescription: r.description,
    isSystem: r.is_system,
    assigned: assignedRoleIds.has(r.id),
  }));

  return { success: true, data: roles };
}

/**
 * Update user's role assignments within an organization
 */
export async function updateUserRoles(
  userId: string,
  organisationId: string,
  roleIds: string[]
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Delete existing role assignments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", organisationId);

  if (deleteError) {
    console.error("Failed to delete user roles:", deleteError);
    return { success: false, error: "Failed to update roles", code: "DELETE_FAILED" };
  }

  // Insert new role assignments
  if (roleIds.length > 0) {
    const assignments = roleIds.map((roleId) => ({
      user_id: userId,
      organization_id: organisationId,
      role_id: roleId,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("user_roles")
      .insert(assignments);

    if (insertError) {
      console.error("Failed to insert user roles:", insertError);
      return { success: false, error: "Failed to update roles", code: "INSERT_FAILED" };
    }
  }

  return { success: true, data: undefined };
}
