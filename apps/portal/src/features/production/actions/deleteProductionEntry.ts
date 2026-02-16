"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isProducer, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete a production entry and all its related inputs/outputs.
 *
 * For validated entries, this reverses all inventory changes:
 * - Input packages are restored (pieces and volume added back)
 * - Consumed packages are restored to "produced" status
 * - Output packages are deleted from inventory
 *
 * Multi-tenancy:
 * - Organisation users can only delete their own organisation's draft entries
 * - Super Admin can delete any entry (draft or validated)
 */
export async function deleteProductionEntry(
  entryId: string
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!entryId || !UUID_REGEX.test(entryId)) {
    return { success: false, error: "Invalid entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Fetch entry — verify it exists and ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: fetchError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, status, organisation_id")
    .eq("id", entryId)
    .single();

  if (fetchError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  // Organisation users can only delete their own organisation's entries
  if (isOrganisationUser(session) && entry.organisation_id !== session.organisationId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Only allow deleting draft or validated entries (not other statuses like "failed")
  if (entry.status !== "draft" && entry.status !== "validated") {
    return { success: false, error: "Cannot delete entry in this status", code: "VALIDATION_FAILED" };
  }

  // Deleting validated entries requires producer role (or super admin)
  const isAdmin = isSuperAdmin(session);
  if (entry.status === "validated" && !isAdmin && !isProducer(session)) {
    return { success: false, error: "Only producers can delete validated entries", code: "FORBIDDEN" };
  }

  // Check if any correction entries reference this entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: corrections } = await (supabase as any)
    .from("portal_production_entries")
    .select("id")
    .eq("corrects_entry_id", entryId)
    .limit(1);

  if (corrections && corrections.length > 0) {
    return {
      success: false,
      error: "Cannot delete: this entry has correction entries. Delete the corrections first.",
      code: "VALIDATION_FAILED",
    };
  }

  // Get package numbers from outputs BEFORE deleting (needed for cleanup)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outputs } = await (supabase as any)
    .from("portal_production_outputs")
    .select("package_number")
    .eq("production_entry_id", entryId);

  const outputPackageNumbers = (outputs || [])
    .map((o: { package_number: string | null }) => o.package_number)
    .filter((pn: string | null): pn is string => !!pn);

  // For validated entries, we need to:
  // 1. Check if any output packages are used as inputs elsewhere
  // 2. Restore input packages to their original state
  // 3. Delete output packages from inventory
  if (entry.status === "validated") {
    // Get packages created by this production entry (by production_entry_id link)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linkedPackages } = await (supabase as any)
      .from("inventory_packages")
      .select("id")
      .eq("production_entry_id", entryId);

    // Also get packages by package_number (catches orphaned packages)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: packagesByNumber } = outputPackageNumbers.length > 0
      ? await (supabase as any)
          .from("inventory_packages")
          .select("id")
          .eq("organisation_id", entry.organisation_id)
          .in("package_number", outputPackageNumbers)
      : { data: [] };

    // Combine all package IDs (deduplicate)
    const allPackageIds = new Set<string>();
    for (const p of linkedPackages || []) allPackageIds.add(p.id);
    for (const p of packagesByNumber || []) allPackageIds.add(p.id);
    const outputPackageIds = Array.from(allPackageIds);

    if (outputPackageIds.length > 0) {
      // Check if any of these packages are used as inputs in OTHER production entries
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: usedInputs } = await (supabase as any)
        .from("portal_production_inputs")
        .select("id, production_entry_id")
        .in("package_id", outputPackageIds)
        .neq("production_entry_id", entryId);

      if (usedInputs && usedInputs.length > 0) {
        return {
          success: false,
          error: "Cannot delete: output packages from this production are used as inputs in other production entries",
          code: "VALIDATION_FAILED",
        };
      }
    }

    // STEP 1: Restore input packages to their original state
    // Fetch all inputs with their package info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inputs } = await (supabase as any)
      .from("portal_production_inputs")
      .select(`
        id,
        package_id,
        pieces_used,
        volume_m3,
        inventory_packages(id, pieces, volume_m3, status, shipment_id)
      `)
      .eq("production_entry_id", entryId);

    // Restore each input package
    for (const input of inputs || []) {
      const pkg = input.inventory_packages;
      if (!pkg) continue;

      const currentVolume = parseFloat(pkg.volume_m3) || 0;
      const volumeToRestore = parseFloat(input.volume_m3) || 0;
      const newVolume = currentVolume + volumeToRestore;

      // Build update object
      const updateData: { pieces?: string | null; volume_m3: number; status?: string } = {
        volume_m3: newVolume,
      };

      // Handle pieces restoration:
      // - If pieces_used is null, this was a volume-only input, restore pieces to null
      // - Otherwise, calculate and restore the pieces count
      if (input.pieces_used === null) {
        // Volume-only package - restore pieces to null so it shows up in queries
        updateData.pieces = null;
      } else {
        const currentPieces = pkg.pieces ? parseInt(pkg.pieces, 10) : 0;
        const newPieces = currentPieces + input.pieces_used;
        updateData.pieces = String(newPieces);
      }

      // Restore status if package was consumed
      if (pkg.status === "consumed") {
        // Restore to appropriate status based on package origin
        updateData.status = pkg.shipment_id ? "produced" : "produced";
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("inventory_packages")
        .update(updateData)
        .eq("id", input.package_id);
    }

    // STEP 2: Delete output packages from inventory
    if (outputPackageIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: packagesDeleteError } = await (supabase as any)
        .from("inventory_packages")
        .delete()
        .in("id", outputPackageIds);

      if (packagesDeleteError) {
        return { success: false, error: `Failed to delete inventory packages: ${packagesDeleteError.message}`, code: "DELETE_FAILED" };
      }
    }
  }

  // Delete related outputs first (foreign key)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: outputsDeleteError } = await (supabase as any)
    .from("portal_production_outputs")
    .delete()
    .eq("production_entry_id", entryId);

  if (outputsDeleteError) {
    return { success: false, error: `Failed to delete outputs: ${outputsDeleteError.message}`, code: "DELETE_FAILED" };
  }

  // Delete related inputs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: inputsDeleteError } = await (supabase as any)
    .from("portal_production_inputs")
    .delete()
    .eq("production_entry_id", entryId);

  if (inputsDeleteError) {
    return { success: false, error: `Failed to delete inputs: ${inputsDeleteError.message}`, code: "DELETE_FAILED" };
  }

  // Delete the entry itself
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("portal_production_entries")
    .delete()
    .eq("id", entryId);

  if (deleteError) {
    return { success: false, error: deleteError.message, code: "DELETE_FAILED" };
  }

  // Invalidate caches so changes show immediately
  revalidatePath("/production");
  revalidatePath("/inventory");

  return { success: true, data: null };
}
