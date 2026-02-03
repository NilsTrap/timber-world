"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete an inventory package.
 *
 * Multi-tenancy:
 * - Only Super Admin can delete inventory packages
 * - Validates that package is not used as input in any production entry
 */
export async function deleteInventoryPackage(
  packageId: string
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  // Only Super Admin can delete inventory packages
  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!packageId || !UUID_REGEX.test(packageId)) {
    return { success: false, error: "Invalid package ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Check if package exists and get its shipment_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pkg, error: fetchError } = await (supabase as any)
    .from("inventory_packages")
    .select("id, shipment_id")
    .eq("id", packageId)
    .single();

  if (fetchError || !pkg) {
    return { success: false, error: "Package not found", code: "NOT_FOUND" };
  }

  const shipmentId = pkg.shipment_id;

  // Check if package is used as input in any production entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usedInputs } = await (supabase as any)
    .from("portal_production_inputs")
    .select("id")
    .eq("package_id", packageId)
    .limit(1);

  if (usedInputs && usedInputs.length > 0) {
    return {
      success: false,
      error: "Cannot delete: package is used as input in a production entry",
      code: "VALIDATION_FAILED",
    };
  }

  // Delete the package
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("inventory_packages")
    .delete()
    .eq("id", packageId);

  if (deleteError) {
    return { success: false, error: deleteError.message, code: "DELETE_FAILED" };
  }

  // Clean up orphaned shipment if this was the last package
  if (shipmentId) {
    // Check if shipment has any remaining packages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: remainingPackages } = await (supabase as any)
      .from("inventory_packages")
      .select("id")
      .eq("shipment_id", shipmentId)
      .limit(1);

    // If no packages remain, delete the shipment
    if (!remainingPackages || remainingPackages.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("shipments")
        .delete()
        .eq("id", shipmentId);
      // Note: We don't fail the operation if shipment delete fails
      // The package is already deleted, which was the primary goal
    }
  }

  return { success: true, data: null };
}
