"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Toggle Organisation External Flag
 *
 * Marks an organisation as external (supplier/customer that doesn't use the platform)
 * or internal (uses the platform for inventory management).
 *
 * External organisations can only be sources for incoming shipments.
 */
export async function toggleOrganisationExternal(
  id: string,
  isExternal: boolean
): Promise<ActionResult<{ isExternal: boolean }>> {
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

  // 4. Update organisation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organisations")
    .update({ is_external: isExternal })
    .eq("id", id)
    .select("is_external")
    .single();

  if (error) {
    console.error("Failed to update organisation:", error);
    return {
      success: false,
      error: "Failed to update organisation",
      code: "UPDATE_FAILED",
    };
  }

  return {
    success: true,
    data: { isExternal: data.is_external },
  };
}
