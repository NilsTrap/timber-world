"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { isValidUUID } from "../types";
import type { ActionResult } from "../types";

/**
 * Toggle Party Active Status
 *
 * Activates or deactivates a party.
 * Admin only endpoint.
 */
export async function toggleParty(
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

  // 3. Validate party ID
  if (!isValidUUID(id)) {
    return {
      success: false,
      error: "Invalid party ID",
      code: "INVALID_ID",
    };
  }

  const supabase = await createClient();

  // 4. Update party status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("parties")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id, is_active")
    .single();

  if (error) {
    console.error("Failed to toggle party:", error);
    return {
      success: false,
      error: "Failed to update party status",
      code: "UPDATE_FAILED",
    };
  }

  if (!data) {
    return {
      success: false,
      error: "Party not found",
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
