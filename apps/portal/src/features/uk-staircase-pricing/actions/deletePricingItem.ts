"use server";

import { createAdminClient } from "@timber/database";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Delete a UK staircase pricing item by ID
 */
export async function deletePricingItem(
  id: string
): Promise<ActionResult<{ deleted: boolean }>> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  if (!id) {
    return {
      success: false,
      error: "Item ID is required",
      code: "INVALID_INPUT",
    };
  }

  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("uk_staircase_pricing")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete pricing item:", error);
    return {
      success: false,
      error: "Failed to delete pricing item",
      code: "DELETE_FAILED",
    };
  }

  return {
    success: true,
    data: { deleted: true },
  };
}
