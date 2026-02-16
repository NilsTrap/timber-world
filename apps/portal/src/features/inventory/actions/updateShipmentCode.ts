"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "@/features/shipments/types";

/**
 * Update Shipment Code
 *
 * Updates the shipment code for a shipment. Super Admin only.
 */
export async function updateShipmentCode(
  shipmentId: string,
  newCode: string
): Promise<ActionResult<{ shipmentId: string; shipmentCode: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!shipmentId) {
    return { success: false, error: "Shipment ID is required", code: "VALIDATION_FAILED" };
  }

  const normalizedCode = newCode?.trim().toUpperCase() || "-";
  const supabase = await createClient();

  // Check uniqueness (except for 'ADMIN', '-', and '' which allow duplicates)
  const allowDuplicates = ["ADMIN", "-", ""].includes(normalizedCode);
  if (!allowDuplicates) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("shipments")
      .select("id")
      .eq("shipment_code", normalizedCode)
      .neq("id", shipmentId)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: `Shipment code "${normalizedCode}" already exists`, code: "DUPLICATE_CODE" };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("shipments")
    .update({ shipment_code: normalizedCode })
    .eq("id", shipmentId);

  if (error) {
    console.error("Failed to update shipment code:", error);
    return { success: false, error: `Failed to update shipment code: ${error.message}`, code: "UPDATE_FAILED" };
  }

  revalidatePath("/inventory");
  revalidatePath("/shipments");

  return { success: true, data: { shipmentId, shipmentCode: normalizedCode } };
}
