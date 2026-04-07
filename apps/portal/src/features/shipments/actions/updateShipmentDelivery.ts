"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Update shipment delivery address texts (for print documents).
 */
export async function updateShipmentDelivery(
  shipmentId: string,
  field: "delivery_from_text" | "delivery_to_text",
  value: string | null
): Promise<ActionResult<{ updated: true }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("shipments")
    .update({ [field]: value || null })
    .eq("id", shipmentId);

  if (error) {
    console.error("Failed to update delivery address:", error);
    return { success: false, error: "Failed to update", code: "UPDATE_FAILED" };
  }

  return { success: true, data: { updated: true } };
}
