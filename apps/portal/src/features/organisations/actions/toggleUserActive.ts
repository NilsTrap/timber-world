"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrganisationUser, ActionResult } from "../types";
import { isValidUUID } from "../types";
import { logAudit } from "@/features/audit/logAudit";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";
import { setPersonAccountActive } from "../services/personOnboarding";

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
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return ADMIN_DENIED;

  // 3. Validate IDs
  if (!isValidUUID(userId)) {
    return ADMIN_DENIED;
  }

  // organisationId is advisory (is_active is person-level) — validate only if given.
  if (organisationId && !isValidUUID(organisationId)) {
    return ADMIN_DENIED;
  }

  const supabase = createAdminClient();

  // 4. Verify the user exists. is_active is a person-level flag (not per-org), so
  //    this is not bound to one org — the person-centric view toggles a user who
  //    may belong to several orgs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingUser } = await (supabase as any)
    .from("portal_users")
    .select("id")
    .eq("id", userId)
    .single();

  if (!existingUser) {
    return ADMIN_DENIED;
  }

  // 5. Update is_active status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changed = await setPersonAccountActive(supabase, userId, isActive);
  if (!changed.ok) {
    return {
      success: false,
      error: "Failed to update user status",
      code: "UPDATE_FAILED",
    };
  }
  const data = changed.user;

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

  await logAudit({
    action: isActive ? "portal_user.activate" : "portal_user.deactivate",
    resourceType: "portal_user",
    resourceId: userId,
    organisationId: organisationId || null,
    metadata: { isActive: user.isActive, email: user.email },
  });

  return {
    success: true,
    data: user,
  };
}
