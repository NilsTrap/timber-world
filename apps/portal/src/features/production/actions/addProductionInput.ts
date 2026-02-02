"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AddProductionInputParams {
  productionEntryId: string;
  packageId: string;
  piecesUsed: number | null;
  volumeM3: number;
}

/**
 * Add Production Input
 *
 * Inserts a new input line linking a production entry to an inventory package.
 * Validates pieces_used <= available pieces and volume_m3 <= package total volume.
 */
export async function addProductionInput(
  params: AddProductionInputParams
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const isAdmin = isSuperAdmin(session);
  if (!isProducer(session) && !isAdmin) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const { productionEntryId, packageId, piecesUsed, volumeM3 } = params;

  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid production entry ID", code: "INVALID_INPUT" };
  }
  if (!packageId || !UUID_REGEX.test(packageId)) {
    return { success: false, error: "Invalid package ID", code: "INVALID_INPUT" };
  }
  if (volumeM3 <= 0) {
    return { success: false, error: "Volume must be greater than 0", code: "INVALID_INPUT" };
  }
  if (piecesUsed !== null && piecesUsed <= 0) {
    return { success: false, error: "Pieces must be greater than 0", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Verify production entry exists, belongs to this user (or user is admin), and check status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, created_by, status")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }
  // Admins can edit any entry; regular users only their own
  if (!isAdmin && entry.created_by !== session.id) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }
  // Regular users can only modify drafts; admins can modify validated entries too
  if (!isAdmin && entry.status !== "draft") {
    return { success: false, error: "Cannot modify a validated production entry", code: "VALIDATION_FAILED" };
  }
  if (isAdmin && entry.status !== "draft" && entry.status !== "validated") {
    return { success: false, error: "Cannot modify entry in this status", code: "VALIDATION_FAILED" };
  }

  // Fetch the package to validate constraints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pkg, error: pkgError } = await (supabase as any)
    .from("inventory_packages")
    .select("pieces, volume_m3")
    .eq("id", packageId)
    .single();

  if (pkgError || !pkg) {
    return { success: false, error: "Package not found", code: "NOT_FOUND" };
  }

  // Validate pieces_used <= available pieces
  if (piecesUsed !== null && pkg.pieces) {
    const availablePieces = parseInt(pkg.pieces, 10);
    if (!isNaN(availablePieces) && piecesUsed > availablePieces) {
      return { success: false, error: "Pieces exceeds available inventory", code: "VALIDATION_FAILED" };
    }
  }

  // Validate volume_m3 <= package total volume (with precision tolerance matching display)
  if (pkg.volume_m3 != null) {
    const packageVolume = Number(pkg.volume_m3);
    const roundedRequest = Math.round(volumeM3 * 1000) / 1000;
    const roundedAvailable = Math.round(packageVolume * 1000) / 1000;
    if (roundedRequest > roundedAvailable) {
      return { success: false, error: "Volume exceeds available inventory", code: "VALIDATION_FAILED" };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_production_inputs")
    .insert({
      production_entry_id: productionEntryId,
      package_id: packageId,
      pieces_used: piecesUsed,
      volume_m3: volumeM3,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to add production input:", error);
    return { success: false, error: `Failed to add input: ${error.message}`, code: "INSERT_FAILED" };
  }

  return { success: true, data: { id: data.id } };
}
