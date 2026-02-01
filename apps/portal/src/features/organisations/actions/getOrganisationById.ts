"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { Organisation, ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Get Organisation by ID
 *
 * Fetches a single organisation by its ID with user count.
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

  // 4. Fetch organisation with user count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Note: Must specify the FK explicitly due to multiple relationships (Epic 10 added user_roles, user_permission_overrides)
  const { data, error } = await client
    .from("organisations")
    .select("id, code, name, is_active, created_at, updated_at, portal_users!portal_users_party_id_fkey(count)")
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

  // 5. Transform snake_case to camelCase
  const organisation: Organisation = {
    id: data.id as string,
    code: data.code as string,
    name: data.name as string,
    isActive: data.is_active as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    userCount: data.portal_users?.[0]?.count ?? 0,
  };

  return {
    success: true,
    data: organisation,
  };
}
