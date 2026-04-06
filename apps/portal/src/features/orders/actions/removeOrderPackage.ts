"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Remove a package from an order.
 * Only "ordered" status packages can be removed (not yet produced).
 */
export async function removeOrderPackage(
  packageId: string
): Promise<ActionResult<{ deleted: true }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    const userOrgId = session.currentOrganizationId || session.organisationId;
    const canCreate = await orgHasModule(userOrgId, "orders.create");
    if (!canCreate) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
  }

  if (!isValidUUID(packageId)) {
    return { success: false, error: "Invalid package ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Only delete if status is "ordered" (not yet produced)
  const { error } = await client
    .from("inventory_packages")
    .delete()
    .eq("id", packageId)
    .eq("status", "ordered");

  if (error) {
    console.error("[removeOrderPackage] Failed:", error);
    return { success: false, error: "Failed to remove package", code: "DELETE_FAILED" };
  }

  return { success: true, data: { deleted: true } };
}
