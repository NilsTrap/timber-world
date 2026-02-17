"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { Organisation, ActionResult } from "../types";

/**
 * Get Organisations
 *
 * Fetches all organisations with user count, sorted by code.
 * User count includes both legacy (portal_users.organisation_id) and
 * multi-org (organization_memberships) users.
 *
 * Admin only endpoint.
 *
 * @param options.includeInactive - If true, includes inactive organisations. Default: false
 */
export async function getOrganisations(
  options?: { includeInactive?: boolean }
): Promise<ActionResult<Organisation[]>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check admin role
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

  const includeInactive = options?.includeInactive ?? false;

  // 3. Fetch organisations
  let query = client
    .from("organisations")
    .select("id, code, name, is_active, is_external, created_at, updated_at");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.order("code", { ascending: true });

  if (error) {
    console.error("Failed to fetch organisations:", error);
    return {
      success: false,
      error: "Failed to fetch organisations",
      code: "FETCH_FAILED",
    };
  }

  // 4. Fetch all legacy users grouped by org
  const { data: allLegacyUsers } = await client
    .from("portal_users")
    .select("id, organisation_id");

  // Build map of org_id -> set of user IDs
  const legacyUsersByOrg = new Map<string, Set<string>>();
  for (const u of (allLegacyUsers || [])) {
    if (!u.organisation_id) continue;
    if (!legacyUsersByOrg.has(u.organisation_id)) {
      legacyUsersByOrg.set(u.organisation_id, new Set());
    }
    legacyUsersByOrg.get(u.organisation_id)!.add(u.id);
  }

  // 5. Fetch all active memberships
  const { data: allMemberships } = await client
    .from("organization_memberships")
    .select("organization_id, user_id")
    .eq("is_active", true);

  // Build map of org_id -> count of additional members (not in legacy)
  const additionalCountsByOrg = new Map<string, number>();
  for (const m of (allMemberships || [])) {
    const orgId = m.organization_id;
    const userId = m.user_id;

    // Check if this user is already counted via legacy for this org
    const legacyUsers = legacyUsersByOrg.get(orgId);
    if (legacyUsers && legacyUsers.has(userId)) {
      continue; // Already counted
    }

    additionalCountsByOrg.set(orgId, (additionalCountsByOrg.get(orgId) || 0) + 1);
  }

  // 6. Transform and merge counts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organisations: Organisation[] = (data || []).map((row: any) => {
    const legacyCount = legacyUsersByOrg.get(row.id)?.size ?? 0;
    const additionalCount = additionalCountsByOrg.get(row.id) ?? 0;

    return {
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      isActive: row.is_active as boolean,
      isExternal: row.is_external as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      userCount: legacyCount + additionalCount,
    };
  });

  return {
    success: true,
    data: organisations,
  };
}
