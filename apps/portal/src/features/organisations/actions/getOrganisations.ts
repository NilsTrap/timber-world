"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { Organisation, ActionResult } from "../types";

/**
 * Get Organisations
 *
 * Fetches all organisations with user count, sorted by code.
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

  // 3. Fetch organisations with user count using LEFT JOIN
  // We use a raw query to get aggregated user counts per organisation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Build the active filter for the RPC or query
  const includeInactive = options?.includeInactive ?? false;

  // Use Supabase's ability to select with counts via foreign key relations
  // portal_users has organisation_id that references organisations.id
  // Note: Must specify the FK explicitly due to multiple relationships (Epic 10 added user_roles, user_permission_overrides)
  let query = client
    .from("organisations")
    .select("id, code, name, is_active, created_at, updated_at, portal_users!portal_users_party_id_fkey(count)");

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

  // 4. Transform snake_case to camelCase and extract user count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organisations: Organisation[] = (data || []).map((row: any) => ({
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    // Supabase returns count as [{ count: number }] for aggregated relations
    userCount: row.portal_users?.[0]?.count ?? 0,
  }));

  return {
    success: true,
    data: organisations,
  };
}
