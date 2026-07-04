"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { logAudit } from "@/features/audit/logAudit";

/**
 * Delete Organisation User
 *
 * Permanently deletes a user from an organisation.
 * Also deletes the associated auth.users record if it exists.
 *
 * Super Admin only endpoint.
 */
export async function deleteOrganisationUser(
  userId: string,
  organisationId: string
): Promise<ActionResult<{ deleted: true }>> {
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

  // 4. Get user to verify ownership and get auth_user_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user, error: fetchError } = await (supabase as any)
    .from("portal_users")
    .select("id, organisation_id, auth_user_id")
    .eq("id", userId)
    .single();

  if (fetchError || !user) {
    return {
      success: false,
      error: "User not found",
      code: "USER_NOT_FOUND",
    };
  }

  if (user.organisation_id !== organisationId) {
    return {
      success: false,
      error: "User does not belong to this organisation",
      code: "USER_ORG_MISMATCH",
    };
  }

  // 5. Delete auth.users record if it exists
  if (user.auth_user_id) {
    const supabaseAdmin = createAdminClient();
    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(user.auth_user_id);

    if (authDeleteError) {
      console.error("Failed to delete auth user:", authDeleteError);
      // Continue with portal_users deletion even if auth deletion fails
      // The auth record will be orphaned but won't cause login issues
    }
  }

  // 6. Delete portal_users record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("portal_users")
    .delete()
    .eq("id", userId);

  if (deleteError) {
    console.error("Failed to delete organisation user:", deleteError);
    return {
      success: false,
      error: "Failed to delete user",
      code: "DELETE_FAILED",
    };
  }

  await logAudit({
    action: "portal_user.delete",
    resourceType: "portal_user",
    resourceId: userId,
    organisationId,
    metadata: { hadAuthUser: !!user.auth_user_id },
  });

  return {
    success: true,
    data: { deleted: true },
  };
}
