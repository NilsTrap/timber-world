"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Revert Failed Validation
 *
 * Undoes a validation that failed midway by:
 * 1. Restoring input package pieces/volumes from production_inputs
 * 2. Deleting any output inventory packages that were created
 * 3. Resetting the entry status to "draft"
 */
export async function revertFailedValidation(
  productionEntryId: string
): Promise<ActionResult<{ message: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const isAdmin = isSuperAdmin(session);
  if (!isProducer(session) && !isAdmin) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid production entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // 1. Fetch entry and verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, status, created_by")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  // Admins can revert any entry; regular users only their own
  if (!isAdmin && entry.created_by !== session.id) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Only allow reverting entries that are in draft, validating, or validated (admin only) status
  const allowedStatuses = isAdmin ? ["draft", "validating", "validated"] : ["draft", "validating"];
  if (!allowedStatuses.includes(entry.status)) {
    return { success: false, error: `Cannot revert entry with status: ${entry.status}`, code: "INVALID_STATUS" };
  }

  // 2. Fetch all inputs with their pieces_used and volume_m3
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inputs, error: inputsError } = await (supabase as any)
    .from("portal_production_inputs")
    .select("id, package_id, pieces_used, volume_m3")
    .eq("production_entry_id", productionEntryId);

  if (inputsError) {
    return { success: false, error: "Failed to fetch inputs", code: "QUERY_FAILED" };
  }

  // 3. Restore each input package
  let restoredCount = 0;
  for (const input of inputs || []) {
    // Fetch current package state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pkg, error: pkgError } = await (supabase as any)
      .from("inventory_packages")
      .select("id, pieces, volume_m3, status")
      .eq("id", input.package_id)
      .single();

    if (pkgError || !pkg) {
      console.error(`Package not found: ${input.package_id}`);
      continue;
    }

    // Restore pieces if applicable
    if (input.pieces_used && input.pieces_used > 0) {
      const currentPieces = parseInt(pkg.pieces || "0", 10);
      const restoredPieces = currentPieces + input.pieces_used;

      // Calculate restored volume proportionally
      const currentVolume = Number(pkg.volume_m3) || 0;
      const ratio = currentPieces > 0 ? restoredPieces / currentPieces : 1;
      const restoredVolume = currentVolume * ratio;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("inventory_packages")
        .update({
          pieces: String(restoredPieces),
          volume_m3: restoredVolume,
          status: pkg.status === "consumed" ? "produced" : pkg.status,
        })
        .eq("id", pkg.id);

      if (updateError) {
        console.error(`Failed to restore package ${pkg.id}:`, updateError);
      } else {
        restoredCount++;
      }
    } else if (input.volume_m3 && input.volume_m3 > 0) {
      // Restore volume only
      const currentVolume = Number(pkg.volume_m3) || 0;
      const restoredVolume = currentVolume + Number(input.volume_m3);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("inventory_packages")
        .update({
          volume_m3: restoredVolume,
          status: pkg.status === "consumed" ? "produced" : pkg.status,
        })
        .eq("id", pkg.id);

      if (updateError) {
        console.error(`Failed to restore package ${pkg.id}:`, updateError);
      } else {
        restoredCount++;
      }
    }
  }

  // 4. Delete any output inventory packages that were created from this entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deletedOutputs, error: deleteError } = await (supabase as any)
    .from("inventory_packages")
    .delete()
    .eq("production_entry_id", productionEntryId)
    .select("id");

  if (deleteError) {
    console.error("Failed to delete output packages:", deleteError);
  }

  const deletedCount = deletedOutputs?.length || 0;

  // 5. Reset entry status to draft
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateEntryError } = await (supabase as any)
    .from("portal_production_entries")
    .update({
      status: "draft",
      validated_at: null,
      total_input_m3: null,
      total_output_m3: null,
      outcome_percentage: null,
      waste_percentage: null,
    })
    .eq("id", productionEntryId);

  if (updateEntryError) {
    return { success: false, error: `Failed to reset entry status: ${updateEntryError.message}`, code: "UPDATE_FAILED" };
  }

  return {
    success: true,
    data: {
      message: `Reverted successfully. Restored ${restoredCount} input package(s), deleted ${deletedCount} output package(s).`,
    },
  };
}
