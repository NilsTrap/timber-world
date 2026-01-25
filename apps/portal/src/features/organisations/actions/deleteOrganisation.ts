"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { isValidUUID } from "../types";
import type { ActionResult } from "../types";

/**
 * Delete Organisation
 *
 * Permanently deletes an organisation.
 * Only allowed if the organisation has no shipments.
 * Admin only endpoint.
 */
export async function deleteOrganisation(
  id: string
): Promise<ActionResult<{ id: string }>> {
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

  // 4. Check for existing shipments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: fromCount } = await (supabase as any)
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("from_organisation_id", id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: toCount } = await (supabase as any)
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("to_organisation_id", id);

  const totalShipments = (fromCount ?? 0) + (toCount ?? 0);

  if (totalShipments > 0) {
    return {
      success: false,
      error: `Cannot delete: organisation has ${totalShipments} shipment${totalShipments !== 1 ? "s" : ""}`,
      code: "HAS_SHIPMENTS",
    };
  }

  // 5. Delete organisation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("organisations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete organisation:", error);
    return {
      success: false,
      error: "Failed to delete organisation",
      code: "DELETE_FAILED",
    };
  }

  return {
    success: true,
    data: { id },
  };
}
