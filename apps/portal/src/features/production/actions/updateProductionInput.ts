"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer, isSuperAdmin, isOrganisationUser } from "@/lib/auth";
import type { ActionResult } from "../types";
import { recalculateEntryMetrics } from "./recalculateEntryMetrics";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UpdateProductionInputParams {
  inputId: string;
  piecesUsed: number | null;
  volumeM3: number;
}

/**
 * Update Production Input
 *
 * Updates pieces_used and/or volume_m3 for an input line.
 * Validates pieces_used <= available pieces and volume_m3 <= package total volume.
 * Changes are staged until the entry is validated via validateProduction.
 */
export async function updateProductionInput(
  params: UpdateProductionInputParams
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const isAdmin = isSuperAdmin(session);
  if (!isProducer(session) && !isAdmin) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const { inputId, piecesUsed, volumeM3 } = params;

  if (!inputId || !UUID_REGEX.test(inputId)) {
    return { success: false, error: "Invalid input ID", code: "INVALID_INPUT" };
  }
  if (volumeM3 <= 0) {
    return { success: false, error: "Volume must be greater than 0", code: "INVALID_INPUT" };
  }
  if (piecesUsed !== null && piecesUsed <= 0) {
    return { success: false, error: "Pieces must be greater than 0", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Fetch the input + package to validate constraints (include current values for diff calculation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: input, error: fetchError } = await (supabase as any)
    .from("portal_production_inputs")
    .select(`
      id, package_id, production_entry_id, pieces_used, volume_m3,
      inventory_packages!portal_production_inputs_package_id_fkey(pieces, volume_m3, status)
    `)
    .eq("id", inputId)
    .single();

  if (fetchError || !input) {
    return { success: false, error: "Input not found", code: "NOT_FOUND" };
  }

  // Verify production entry ownership and status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("created_by, status, organisation_id")
    .eq("id", input.production_entry_id)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  // Permission check:
  // - Admins can edit any entry
  // - Producers can edit entries from their organization (drafts they created, or any validated)
  const isOwnEntry = entry.created_by === session.id;
  const isOrgEntry = isOrganisationUser(session) && entry.organisation_id === session.organisationId;
  if (!isAdmin && !isOwnEntry && !isOrgEntry) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Check if user can modify this entry:
  // - Drafts: entry owner or admin
  // - Validated: admin OR producer from same organization (for edit mode)
  const canModifyValidated = isAdmin || (isProducer(session) && entry.status === "validated");
  if (!canModifyValidated && entry.status !== "draft") {
    return { success: false, error: "Cannot modify a validated production entry", code: "VALIDATION_FAILED" };
  }
  if (entry.status !== "draft" && entry.status !== "validated") {
    return { success: false, error: "Cannot modify entry in this status", code: "VALIDATION_FAILED" };
  }

  const pkg = input.inventory_packages;

  // Validate against package totals
  if (piecesUsed !== null && pkg?.pieces) {
    const availablePieces = parseInt(pkg.pieces, 10);
    if (!isNaN(availablePieces) && piecesUsed > availablePieces) {
      return { success: false, error: "Pieces exceeds available inventory", code: "VALIDATION_FAILED" };
    }
  }

  if (pkg?.volume_m3 != null) {
    const packageVolume = Number(pkg.volume_m3);
    const roundedRequest = Math.round(volumeM3 * 1000) / 1000;
    const roundedAvailable = Math.round(packageVolume * 1000) / 1000;
    if (roundedRequest > roundedAvailable) {
      return { success: false, error: "Volume exceeds available inventory", code: "VALIDATION_FAILED" };
    }
  }

  // Update the input record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("portal_production_inputs")
    .update({
      pieces_used: piecesUsed,
      volume_m3: volumeM3,
    })
    .eq("id", inputId);

  if (error) {
    console.error("Failed to update production input:", error);
    return { success: false, error: `Failed to update input: ${error.message}`, code: "UPDATE_FAILED" };
  }

  // Recalculate totals and planned work
  await recalculateEntryMetrics(supabase, input.production_entry_id);

  // Invalidate the production page cache so changes show when navigating back
  revalidatePath("/production");

  return { success: true, data: null };
}
