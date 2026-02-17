"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete a shipment and unlink/delete its packages.
 *
 * Multi-tenancy:
 * - Super Admin can delete any shipment
 * - Org users can delete their own draft shipments (as sender)
 * - Org users can delete incoming draft shipments from external suppliers (as receiver)
 * - Validates that no packages from this shipment are used as production inputs
 *
 * Note: For outgoing shipments, packages are UNLINKED (shipment_id set to null)
 * so they return to available inventory.
 * For incoming shipments from external suppliers, packages are DELETED since they
 * were created specifically for this shipment.
 */
export async function deleteShipment(
  shipmentId: string
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!shipmentId || !UUID_REGEX.test(shipmentId)) {
    return { success: false, error: "Invalid shipment ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Check if shipment exists and get details for authorization
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: fetchError } = await (supabase as any)
    .from("shipments")
    .select(`
      id,
      status,
      from_organisation_id,
      to_organisation_id,
      from_organisation:organisations!shipments_from_party_id_fkey(is_external)
    `)
    .eq("id", shipmentId)
    .single();

  if (fetchError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  // Authorization check:
  // - Super Admin can delete any shipment
  // - Org users can delete their own draft shipments (as sender)
  // - Org users can delete incoming draft shipments from external suppliers (as receiver)
  const isAdmin = isSuperAdmin(session);
  const isOwnDraft =
    shipment.status === "draft" &&
    shipment.from_organisation_id === session.organisationId;
  const isFromExternal = shipment.from_organisation?.is_external ?? false;
  const isIncomingExternalDraft =
    shipment.status === "draft" &&
    shipment.to_organisation_id === session.organisationId &&
    isFromExternal;

  if (!isAdmin && !isOwnDraft && !isIncomingExternalDraft) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
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

    // For incoming shipments from external suppliers, DELETE packages (they were created for this shipment)
    // For outgoing shipments, UNLINK packages (return to available inventory)
    if (isIncomingExternalDraft) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deletePackagesError } = await (supabase as any)
        .from("inventory_packages")
        .delete()
        .eq("shipment_id", shipmentId);

      if (deletePackagesError) {
        return { success: false, error: `Failed to delete packages: ${deletePackagesError.message}`, code: "DELETE_FAILED" };
      }
    } else {
      // Unlink packages from this shipment (return to available inventory)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: unlinkError } = await (supabase as any)
        .from("inventory_packages")
        .update({
          shipment_id: null,
          package_sequence: null,
        })
        .eq("shipment_id", shipmentId);

      if (unlinkError) {
        return { success: false, error: `Failed to unlink packages: ${unlinkError.message}`, code: "UPDATE_FAILED" };
      }
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

  revalidatePath("/shipments");
  revalidatePath("/inventory");

  return { success: true, data: null };
}
