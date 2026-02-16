"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer, isSuperAdmin, isOrganisationUser } from "@/lib/auth";
import type { ActionResult } from "../types";
import { recalculateEntryMetrics } from "./recalculateEntryMetrics";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InputToAdd {
  packageId: string;
  piecesUsed: number | null;
  volumeM3: number;
}

export interface InputToUpdate {
  inputId: string;
  piecesUsed: number | null;
  volumeM3: number;
}

export interface OutputRow {
  dbId: string | null;
  packageNumber: string;
  productNameId: string;
  woodSpeciesId: string;
  humidityId: string;
  typeId: string;
  processingId: string;
  fscId: string;
  qualityId: string;
  thickness: string;
  width: string;
  length: string;
  pieces: string;
  volumeM3: number;
  notes: string;
}

interface ApplyProductionEditsParams {
  productionEntryId: string;
  inputsToAdd: InputToAdd[];
  inputsToUpdate: InputToUpdate[];
  inputIdsToDelete: string[];
  outputs: OutputRow[];
}

interface ApplyProductionEditsResult {
  redirectUrl: string;
}

/**
 * Apply Production Edits (Batch)
 *
 * Applies all pending changes from edit mode in a single operation:
 * - Adds new inputs
 * - Updates existing inputs
 * - Deletes removed inputs
 * - Saves all outputs
 * - Re-validates the production entry
 *
 * This ensures edit mode is fully transactional - either all changes apply or none.
 */
export async function applyProductionEdits(
  params: ApplyProductionEditsParams
): Promise<ActionResult<ApplyProductionEditsResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const isAdmin = isSuperAdmin(session);
  if (!isProducer(session) && !isAdmin) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const { productionEntryId, inputsToAdd, inputsToUpdate, inputIdsToDelete, outputs } = params;

  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid production entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Fetch the production entry to verify ownership and status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, created_by, status, organisation_id, process_id")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  // Permission check: must be admin or producer from same organization
  const isOrgUser = isOrganisationUser(session) && entry.organisation_id === session.organisationId;
  if (!isAdmin && !isOrgUser) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Must be editing a validated entry
  if (entry.status !== "validated") {
    return { success: false, error: "Can only edit validated entries", code: "VALIDATION_FAILED" };
  }

  // ─── STEP 1: Delete inputs marked for deletion ─────────────────────────────

  for (const inputId of inputIdsToDelete) {
    if (!UUID_REGEX.test(inputId)) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from("portal_production_inputs")
      .delete()
      .eq("id", inputId)
      .eq("production_entry_id", productionEntryId);

    if (deleteError) {
      console.error("Failed to delete input:", deleteError);
      return { success: false, error: `Failed to delete input: ${deleteError.message}`, code: "DELETE_FAILED" };
    }
  }

  // ─── STEP 2: Update existing inputs ────────────────────────────────────────

  for (const update of inputsToUpdate) {
    if (!UUID_REGEX.test(update.inputId)) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("portal_production_inputs")
      .update({
        pieces_used: update.piecesUsed,
        volume_m3: update.volumeM3,
      })
      .eq("id", update.inputId)
      .eq("production_entry_id", productionEntryId);

    if (updateError) {
      console.error("Failed to update input:", updateError);
      return { success: false, error: `Failed to update input: ${updateError.message}`, code: "UPDATE_FAILED" };
    }
  }

  // ─── STEP 3: Add new inputs ────────────────────────────────────────────────

  for (const input of inputsToAdd) {
    if (!UUID_REGEX.test(input.packageId)) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("portal_production_inputs")
      .insert({
        production_entry_id: productionEntryId,
        package_id: input.packageId,
        pieces_used: input.piecesUsed,
        volume_m3: input.volumeM3,
      });

    if (insertError) {
      console.error("Failed to add input:", insertError);
      return { success: false, error: `Failed to add input: ${insertError.message}`, code: "INSERT_FAILED" };
    }
  }

  // ─── STEP 4: Save outputs ──────────────────────────────────────────────────

  // Get existing output IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingOutputs } = await (supabase as any)
    .from("portal_production_outputs")
    .select("id")
    .eq("production_entry_id", productionEntryId);

  const existingIds = new Set<string>((existingOutputs || []).map((o: { id: string }) => o.id));
  const newIds = new Set<string | null>(outputs.filter((o) => o.dbId).map((o) => o.dbId));

  // Delete outputs that are no longer in the list
  for (const existingId of existingIds) {
    if (!newIds.has(existingId)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("portal_production_outputs")
        .delete()
        .eq("id", existingId);
    }
  }

  // Upsert outputs
  for (let i = 0; i < outputs.length; i++) {
    const row = outputs[i]!;
    const outputData = {
      production_entry_id: productionEntryId,
      package_number: row.packageNumber || null,
      product_name_id: row.productNameId || null,
      wood_species_id: row.woodSpeciesId || null,
      humidity_id: row.humidityId || null,
      type_id: row.typeId || null,
      processing_id: row.processingId || null,
      fsc_id: row.fscId || null,
      quality_id: row.qualityId || null,
      thickness: row.thickness || null,
      width: row.width || null,
      length: row.length || null,
      pieces: row.pieces || null,
      volume_m3: row.volumeM3,
      notes: row.notes || null,
      sort_order: i,
    };

    if (row.dbId && existingIds.has(row.dbId)) {
      // Update existing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("portal_production_outputs")
        .update(outputData)
        .eq("id", row.dbId);

      if (error) {
        console.error("Failed to update output:", error);
        return { success: false, error: `Failed to update output: ${error.message}`, code: "UPDATE_FAILED" };
      }
    } else {
      // Insert new
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("portal_production_outputs")
        .insert(outputData);

      if (error) {
        console.error("Failed to insert output:", error);
        return { success: false, error: `Failed to insert output: ${error.message}`, code: "INSERT_FAILED" };
      }
    }
  }

  // ─── STEP 5: Recalculate metrics ───────────────────────────────────────────

  await recalculateEntryMetrics(supabase, productionEntryId);

  // ─── STEP 6: Re-validate (apply inventory changes) ─────────────────────────

  // Import and call validateProduction to apply inventory changes
  const { validateProduction } = await import("./validateProduction");
  const validateResult = await validateProduction(productionEntryId);

  if (!validateResult.success) {
    return { success: false, error: validateResult.error, code: validateResult.code };
  }

  revalidatePath("/production");
  revalidatePath("/inventory");

  return {
    success: true,
    data: { redirectUrl: validateResult.data.redirectUrl },
  };
}
