"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult } from "../types";

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
 */
export async function updateProductionInput(
  params: UpdateProductionInputParams
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isProducer(session)) {
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

  // Fetch the input + package to validate constraints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: input, error: fetchError } = await (supabase as any)
    .from("portal_production_inputs")
    .select(`
      id, package_id, production_entry_id,
      inventory_packages!portal_production_inputs_package_id_fkey(pieces, volume_m3)
    `)
    .eq("id", inputId)
    .single();

  if (fetchError || !input) {
    return { success: false, error: "Input not found", code: "NOT_FOUND" };
  }

  // Verify production entry ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("created_by")
    .eq("id", input.production_entry_id)
    .single();

  if (entryError || !entry || entry.created_by !== session.id) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const pkg = input.inventory_packages;

  // Validate pieces_used <= available pieces
  if (piecesUsed !== null && pkg?.pieces) {
    const availablePieces = parseInt(pkg.pieces, 10);
    if (!isNaN(availablePieces) && piecesUsed > availablePieces) {
      return { success: false, error: "Pieces exceeds available inventory", code: "VALIDATION_FAILED" };
    }
  }

  // Validate volume_m3 <= package total volume
  if (pkg?.volume_m3 != null) {
    const packageVolume = Number(pkg.volume_m3);
    if (volumeM3 > packageVolume) {
      return { success: false, error: "Volume exceeds available inventory", code: "VALIDATION_FAILED" };
    }
  }

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

  return { success: true, data: null };
}
