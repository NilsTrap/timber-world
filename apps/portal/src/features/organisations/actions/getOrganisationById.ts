"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { Organisation, ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Get Organisation by ID
 *
 * Fetches a single organisation by its ID with user count.
 * User count includes both legacy (portal_users.organisation_id) and
 * multi-org (organization_memberships) users.
 *
 * Admin only endpoint.
 *
 * @param id - The organisation UUID
 */
export async function getOrganisationById(
  id: string
): Promise<ActionResult<Organisation>> {
  // 1. Validate input
  if (!id || !isValidUUID(id)) {
    return {
      success: false,
      error: "Invalid organisation ID",
      code: "INVALID_INPUT",
    };
  }

  // 2. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 3. Check admin role
  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // 4. Fetch organisation
  const { data, error } = await client
    .from("organisations")
    .select("id, code, name, is_active, is_external, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return {
        success: false,
        error: "Organisation not found",
        code: "NOT_FOUND",
      };
    }
    console.error("Failed to fetch organisation:", error);
    return {
      success: false,
      error: "Failed to fetch organisation",
      code: "FETCH_FAILED",
    };
  }

  // 5. Get legacy user IDs (users with organisation_id = this org)
  const { data: legacyUsers } = await client
    .from("portal_users")
    .select("id")
    .eq("organisation_id", id);

  const legacyUserIds = new Set((legacyUsers || []).map((u: { id: string }) => u.id));

  // 6. Get membership user IDs
  const { data: memberships } = await client
    .from("organization_memberships")
    .select("user_id")
    .eq("organization_id", id)
    .eq("is_active", true);

  // Count membership users that aren't already in legacy
  const additionalMemberCount = (memberships || []).filter(
    (m: { user_id: string }) => !legacyUserIds.has(m.user_id)
  ).length;

  const totalUserCount = legacyUserIds.size + additionalMemberCount;

  // 7. Transform snake_case to camelCase
  const organisation: Organisation = {
    id: data.id as string,
    code: data.code as string,
    name: data.name as string,
    isActive: data.is_active as boolean,
    isExternal: data.is_external as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    userCount: totalUserCount,
  };

  return {
    success: true,
    data: organisation,
  };
}
