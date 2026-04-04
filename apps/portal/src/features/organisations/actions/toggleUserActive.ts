"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { OrganisationUser, ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Toggle User Active Status
 *
 * Activates or deactivates a user within an organisation.
 * When deactivated (is_active = false), the user cannot log in.
 *
 * Super Admin only endpoint.
 */
export async function toggleUserActive(
  userId: string,
  organisationId: string,
  isActive: boolean
): Promise<ActionResult<OrganisationUser>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check Super Admin role
  if (!isSuperAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  // 3. Validate IDs
  if (!isValidUUID(userId)) {
    return {
      success: false,
      error: "Invalid user ID",
      code: "INVALID_USER_ID",
    };
  }

  if (!isValidUUID(organisationId)) {
    return {
      success: false,
      error: "Invalid organisation ID",
      code: "INVALID_ORG_ID",
    };
  }

  const supabase = await createClient();

  // 4. Verify user exists and belongs to the specified organisation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingUser } = await (supabase as any)
    .from("portal_users")
    .select("id, organisation_id")
    .eq("id", userId)
    .single();

  if (!existingUser) {
    return {
      success: false,
      error: "User not found",
      code: "USER_NOT_FOUND",
    };
  }

  if (existingUser.organisation_id !== organisationId) {
    return {
      success: false,
      error: "User does not belong to this organisation",
      code: "USER_ORG_MISMATCH",
    };
  }

  // 5. Update is_active status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_users")
    .update({ is_active: isActive })
    .eq("id", userId)
    .select("id, email, name, role, organisation_id, auth_user_id, is_active, status, invited_at, invited_by, last_login_at, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to toggle user active status:", error);
    return {
      success: false,
      error: "Failed to update user status",
      code: "UPDATE_FAILED",
    };
  }

  // 6. Transform and return
  const user: OrganisationUser = {
    id: data.id as string,
    email: data.email as string,
    name: data.name as string,
    role: data.role as "admin" | "user",
    organisationId: data.organisation_id as string,
    authUserId: data.auth_user_id as string | null,
    isActive: data.is_active as boolean,
    status: data.status as "created" | "invited" | "active",
    invitedAt: data.invited_at as string | null,
    invitedBy: data.invited_by as string | null,
    invitedByName: null, // Not fetched on toggle, will be populated on list
    lastLoginAt: data.last_login_at as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  return {
    success: true,
    data: user,
  };
}
