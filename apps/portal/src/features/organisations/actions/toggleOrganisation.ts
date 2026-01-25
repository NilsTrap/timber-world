"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { isValidUUID } from "../types";
import type { ActionResult } from "../types";

/**
 * Toggle Organisation Active Status
 *
 * Activates or deactivates an organisation.
 * Admin only endpoint.
 */
export async function toggleOrganisation(
  id: string,
  isActive: boolean
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
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

  // 3. Validate organisation ID
  if (!isValidUUID(id)) {
    return {
      success: false,
      error: "Invalid organisation ID",
      code: "INVALID_ID",
    };
  }

  const supabase = await createClient();

  // 4. Update organisation status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organisations")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id, is_active")
    .single();

  if (error) {
    console.error("Failed to toggle organisation:", error);
    return {
      success: false,
      error: "Failed to update organisation status",
      code: "UPDATE_FAILED",
    };
  }

  if (!data) {
    return {
      success: false,
      error: "Organisation not found",
      code: "NOT_FOUND",
    };
  }

  return {
    success: true,
    data: {
      id: data.id as string,
      isActive: data.is_active as boolean,
    },
  };
}
