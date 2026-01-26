"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete a shipment and all its related packages.
 *
 * Multi-tenancy:
 * - Only Super Admin can delete shipments
 * - Validates that no packages from this shipment are used as production inputs
 */
export async function deleteShipment(
  shipmentId: string
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  // Only Super Admin can delete shipments
  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!shipmentId || !UUID_REGEX.test(shipmentId)) {
    return { success: false, error: "Invalid shipment ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Check if shipment exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: fetchError } = await (supabase as any)
    .from("shipments")
    .select("id")
    .eq("id", shipmentId)
    .single();

  if (fetchError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  // Get packages from this shipment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packages } = await (supabase as any)
    .from("inventory_packages")
    .select("id")
    .eq("shipment_id", shipmentId);

  if (packages && packages.length > 0) {
    const packageIds = packages.map((p: { id: string }) => p.id);

    // Check if any packages are used as production inputs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usedInputs } = await (supabase as any)
      .from("portal_production_inputs")
      .select("id")
      .in("package_id", packageIds)
      .limit(1);

    if (usedInputs && usedInputs.length > 0) {
      return {
        success: false,
        error: "Cannot delete: packages from this shipment are used as production inputs",
        code: "VALIDATION_FAILED",
      };
    }

    // Delete all packages from this shipment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: packagesDeleteError } = await (supabase as any)
      .from("inventory_packages")
      .delete()
      .eq("shipment_id", shipmentId);

    if (packagesDeleteError) {
      return { success: false, error: `Failed to delete packages: ${packagesDeleteError.message}`, code: "DELETE_FAILED" };
    }
  }

  // Delete the shipment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("shipments")
    .delete()
    .eq("id", shipmentId);

  if (deleteError) {
    return { success: false, error: deleteError.message, code: "DELETE_FAILED" };
  }

  return { success: true, data: null };
}
