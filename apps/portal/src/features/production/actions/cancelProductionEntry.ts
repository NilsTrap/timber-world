"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cancel a validated production entry and restore inventory.
 *
 * This action:
 * 1. Verifies the entry is validated
 * 2. Checks output packages are not used in other productions
 * 3. Restores input packages to their pre-production state
 * 4. Deletes output packages from inventory
 * 5. Deletes the production entry and its inputs/outputs
 *
 * Only Super Admins can perform this action.
 */
export async function cancelProductionEntry(
  entryId: string
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Only Super Admins can cancel production entries", code: "FORBIDDEN" };
  }

  if (!entryId || !UUID_REGEX.test(entryId)) {
    return { success: false, error: "Invalid entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // 1. Fetch entry and verify it's validated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: fetchError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, status, organisation_id")
    .eq("id", entryId)
    .single();

  if (fetchError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  if (entry.status !== "validated") {
    return { success: false, error: "Only validated entries can be cancelled", code: "VALIDATION_FAILED" };
  }

  // 2. Check if any correction entries reference this entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: corrections } = await (supabase as any)
    .from("portal_production_entries")
    .select("id")
    .eq("corrects_entry_id", entryId)
    .limit(1);

  if (corrections && corrections.length > 0) {
    return {
      success: false,
      error: "Cannot cancel: this entry has correction entries. Delete the corrections first.",
      code: "VALIDATION_FAILED",
    };
  }

  // 3. Get output packages created by this production
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outputPackages } = await (supabase as any)
    .from("inventory_packages")
    .select("id")
    .eq("production_entry_id", entryId);

  if (outputPackages && outputPackages.length > 0) {
    const outputPackageIds = outputPackages.map((p: { id: string }) => p.id);

    // Check if any output packages are used as inputs in OTHER production entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usedInputs } = await (supabase as any)
      .from("portal_production_inputs")
      .select("id, production_entry_id")
      .in("package_id", outputPackageIds)
      .neq("production_entry_id", entryId);

    if (usedInputs && usedInputs.length > 0) {
      return {
        success: false,
        error: "Cannot cancel: output packages from this production are used as inputs in other production entries",
        code: "VALIDATION_FAILED",
      };
    }
  }

  // 4. Fetch inputs to restore inventory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inputs, error: inputsError } = await (supabase as any)
    .from("portal_production_inputs")
    .select("id, package_id, pieces_used, volume_m3")
    .eq("production_entry_id", entryId);

  if (inputsError) {
    return { success: false, error: "Failed to fetch inputs", code: "QUERY_FAILED" };
  }

  // 5. Restore input packages
  for (const input of inputs || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pkg, error: pkgError } = await (supabase as any)
      .from("inventory_packages")
      .select("id, pieces, volume_m3, status, shipment_id, production_entry_id")
      .eq("id", input.package_id)
      .single();

    if (pkgError || !pkg) {
      return { success: false, error: `Input package not found: ${input.package_id}`, code: "NOT_FOUND" };
    }

    const currentPieces = parseInt(pkg.pieces || "0", 10);
    const currentVolume = Number(pkg.volume_m3) || 0;
    const piecesToRestore = input.pieces_used || 0;
    const volumeToRestore = Number(input.volume_m3) || 0;

    // Determine original status (before consumption)
    let restoredStatus = pkg.status;
    if (pkg.status === "consumed") {
      // Restore to appropriate status based on origin
      restoredStatus = pkg.shipment_id ? "received" : "produced";
    }

    const updates: Record<string, unknown> = {
      volume_m3: currentVolume + volumeToRestore,
    };

    // Only update pieces if we have piece data
    if (piecesToRestore > 0) {
      updates.pieces = String(currentPieces + piecesToRestore);
    }

    // Only update status if it was consumed
    if (pkg.status === "consumed") {
      updates.status = restoredStatus;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("inventory_packages")
      .update(updates)
      .eq("id", pkg.id);

    if (updateError) {
      return { success: false, error: `Failed to restore package: ${updateError.message}`, code: "UPDATE_FAILED" };
    }
  }

  // 6. Delete output packages from inventory
  if (outputPackages && outputPackages.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteOutputsError } = await (supabase as any)
      .from("inventory_packages")
      .delete()
      .eq("production_entry_id", entryId);

    if (deleteOutputsError) {
      return { success: false, error: `Failed to delete output packages: ${deleteOutputsError.message}`, code: "DELETE_FAILED" };
    }
  }

  // 7. Delete production outputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: outputsDeleteError } = await (supabase as any)
    .from("portal_production_outputs")
    .delete()
    .eq("production_entry_id", entryId);

  if (outputsDeleteError) {
    return { success: false, error: `Failed to delete outputs: ${outputsDeleteError.message}`, code: "DELETE_FAILED" };
  }

  // 8. Delete production inputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: inputsDeleteError } = await (supabase as any)
    .from("portal_production_inputs")
    .delete()
    .eq("production_entry_id", entryId);

  if (inputsDeleteError) {
    return { success: false, error: `Failed to delete inputs: ${inputsDeleteError.message}`, code: "DELETE_FAILED" };
  }

  // 9. Delete the production entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("portal_production_entries")
    .delete()
    .eq("id", entryId);

  if (deleteError) {
    return { success: false, error: deleteError.message, code: "DELETE_FAILED" };
  }

  return { success: true, data: null };
}
