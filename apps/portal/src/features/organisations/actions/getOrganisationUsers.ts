"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { OrganisationUser, ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Get Organisation Users
 *
 * Fetches all users belonging to a specific organisation.
 * Includes users from both:
 * - Legacy: portal_users.organisation_id
 * - Multi-org: organization_memberships table
 *
 * Super Admin only endpoint.
 *
 * @param organisationId - The organisation ID to fetch users for
 * @param options.includeInactive - If true, includes deactivated users. Default: true
 */
export async function getOrganisationUsers(
  organisationId: string,
  options?: { includeInactive?: boolean }
): Promise<ActionResult<OrganisationUser[]>> {
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

  // 3. Validate organisation ID
  if (!isValidUUID(organisationId)) {
    return {
      success: false,
      error: "Invalid organisation ID",
      code: "INVALID_ID",
    };
  }

  const supabase = await createClient();
  const includeInactive = options?.includeInactive ?? true;

  // 4. Fetch users via legacy organisation_id field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let legacyQuery = (supabase as any)
    .from("portal_users")
    .select("id, email, name, role, organisation_id, auth_user_id, is_active, status, invited_at, invited_by, last_login_at, created_at, updated_at, inviter:portal_users!invited_by(name)")
    .eq("organisation_id", organisationId);

  if (!includeInactive) {
    legacyQuery = legacyQuery.eq("is_active", true);
  }

  const { data: legacyUsers, error: legacyError } = await legacyQuery;

  if (legacyError) {
    console.error("Failed to fetch legacy organisation users:", legacyError);
    return {
      success: false,
      error: "Failed to fetch users",
      code: "FETCH_FAILED",
    };
  }

  // 5. Fetch user IDs from organization_memberships table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let membershipQuery = (supabase as any)
    .from("organization_memberships")
    .select("user_id, is_active")
    .eq("organization_id", organisationId);

  if (!includeInactive) {
    membershipQuery = membershipQuery.eq("is_active", true);
  }

  const { data: memberships, error: membershipError } = await membershipQuery;

  if (membershipError) {
    console.error("Failed to fetch membership users:", membershipError);
    return {
      success: false,
      error: "Failed to fetch users",
      code: "FETCH_FAILED",
    };
  }

  // 6. Get the set of legacy user IDs to avoid duplicates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyUserIds = new Set((legacyUsers || []).map((u: any) => u.id));

  // Filter membership user IDs that aren't already in legacy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const additionalUserIds = (memberships || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((m: any) => !legacyUserIds.has(m.user_id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => ({ id: m.user_id, membershipActive: m.is_active }));

  // 7. Fetch additional users by ID if any
  let additionalUsers: OrganisationUser[] = [];
  if (additionalUserIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIds = additionalUserIds.map((u: any) => u.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: extraUsers, error: extraError } = await (supabase as any)
      .from("portal_users")
      .select("id, email, name, role, organisation_id, auth_user_id, is_active, status, invited_at, invited_by, last_login_at, created_at, updated_at, inviter:portal_users!invited_by(name)")
      .in("id", userIds);

    if (extraError) {
      console.error("Failed to fetch additional users:", extraError);
      // Don't fail entirely, just log the error
    } else {
      // Create a map of membership active states
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const membershipActiveMap = new Map(additionalUserIds.map((u: any) => [u.id, u.membershipActive]));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      additionalUsers = (extraUsers || []).map((row: any) => {
        const membershipActive = membershipActiveMap.get(row.id) ?? true;
        return {
          id: row.id as string,
          email: row.email as string,
          name: row.name as string,
          role: row.role as "admin" | "producer",
          organisationId: organisationId,
          authUserId: row.auth_user_id as string | null,
          isActive: (row.is_active && membershipActive) as boolean,
          status: row.status as "created" | "invited" | "active",
          invitedAt: row.invited_at as string | null,
          invitedBy: row.invited_by as string | null,
          invitedByName: row.inviter?.name as string | null,
          lastLoginAt: row.last_login_at as string | null,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        };
      });
    }
  }

  // 8. Transform legacy users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformedLegacyUsers: OrganisationUser[] = (legacyUsers || []).map((row: any) => ({
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as "admin" | "producer",
    organisationId: row.organisation_id as string,
    authUserId: row.auth_user_id as string | null,
    isActive: row.is_active as boolean,
    status: row.status as "created" | "invited" | "active",
    invitedAt: row.invited_at as string | null,
    invitedBy: row.invited_by as string | null,
    invitedByName: row.inviter?.name as string | null,
    lastLoginAt: row.last_login_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));

  // 9. Combine and sort by name
  const users = [...transformedLegacyUsers, ...additionalUsers].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return {
    success: true,
    data: users,
  };
}
