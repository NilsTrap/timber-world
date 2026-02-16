"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer, isSuperAdmin, isOrganisationUser } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SnapshotInput {
  id: string;
  packageId: string;
  piecesUsed: number | null;
  volumeM3: number;
}

interface SnapshotOutput {
  id: string;
  packageNumber: string | null;
  productNameId: string | null;
  woodSpeciesId: string | null;
  humidityId: string | null;
  typeId: string | null;
  processingId: string | null;
  fscId: string | null;
  qualityId: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number;
  notes: string | null;
  sortOrder: number;
}

interface RestoreProductionSnapshotParams {
  productionEntryId: string;
  originalInputs: SnapshotInput[];
  originalOutputs: SnapshotOutput[];
}

/**
 * Restore Production Snapshot
 *
 * Restores a production entry's inputs and outputs to a previous snapshot.
 * Used when canceling edit mode to discard all changes made during editing.
 */
export async function restoreProductionSnapshot(
  params: RestoreProductionSnapshotParams
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const isAdmin = isSuperAdmin(session);
  if (!isProducer(session) && !isAdmin) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const { productionEntryId, originalInputs, originalOutputs } = params;

  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid production entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Verify the entry exists and user has permission
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, status, organisation_id")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  // Permission check
  const isOrgUser = isOrganisationUser(session) && entry.organisation_id === session.organisationId;
  if (!isAdmin && !isOrgUser) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Must be a validated entry (only validated entries have edit mode)
  if (entry.status !== "validated") {
    return { success: false, error: "Can only restore validated entries", code: "VALIDATION_FAILED" };
  }

  // ─── STEP 1: Delete all current inputs ─────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteInputsError } = await (supabase as any)
    .from("portal_production_inputs")
    .delete()
    .eq("production_entry_id", productionEntryId);

  if (deleteInputsError) {
    console.error("Failed to delete inputs during restore:", deleteInputsError);
    return { success: false, error: "Failed to restore inputs", code: "DELETE_FAILED" };
  }

  // ─── STEP 2: Re-insert original inputs ─────────────────────────────────────

  if (originalInputs.length > 0) {
    const inputRows = originalInputs.map((input) => ({
      id: input.id,
      production_entry_id: productionEntryId,
      package_id: input.packageId,
      pieces_used: input.piecesUsed,
      volume_m3: input.volumeM3,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertInputsError } = await (supabase as any)
      .from("portal_production_inputs")
      .insert(inputRows);

    if (insertInputsError) {
      console.error("Failed to insert inputs during restore:", insertInputsError);
      return { success: false, error: "Failed to restore inputs", code: "INSERT_FAILED" };
    }
  }

  // ─── STEP 3: Delete all current outputs ────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteOutputsError } = await (supabase as any)
    .from("portal_production_outputs")
    .delete()
    .eq("production_entry_id", productionEntryId);

  if (deleteOutputsError) {
    console.error("Failed to delete outputs during restore:", deleteOutputsError);
    return { success: false, error: "Failed to restore outputs", code: "DELETE_FAILED" };
  }

  // ─── STEP 4: Re-insert original outputs ────────────────────────────────────

  if (originalOutputs.length > 0) {
    const outputRows = originalOutputs.map((output) => ({
      id: output.id,
      production_entry_id: productionEntryId,
      package_number: output.packageNumber,
      product_name_id: output.productNameId,
      wood_species_id: output.woodSpeciesId,
      humidity_id: output.humidityId,
      type_id: output.typeId,
      processing_id: output.processingId,
      fsc_id: output.fscId,
      quality_id: output.qualityId,
      thickness: output.thickness,
      width: output.width,
      length: output.length,
      pieces: output.pieces,
      volume_m3: output.volumeM3,
      notes: output.notes,
      sort_order: output.sortOrder,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertOutputsError } = await (supabase as any)
      .from("portal_production_outputs")
      .insert(outputRows);

    if (insertOutputsError) {
      console.error("Failed to insert outputs during restore:", insertOutputsError);
      return { success: false, error: "Failed to restore outputs", code: "INSERT_FAILED" };
    }
  }

  // ─── STEP 5: Recalculate metrics ───────────────────────────────────────────

  const { recalculateEntryMetrics } = await import("./recalculateEntryMetrics");
  await recalculateEntryMetrics(supabase, productionEntryId);

  return { success: true, data: null };
}
