"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create a correction entry linked to an existing validated production entry.
 * The correction inherits the same process_id and uses today's date.
 * Only standard (non-correction) validated entries can be corrected.
 */
export async function createCorrectionEntry(
  originalEntryId: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isProducer(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!originalEntryId || !UUID_REGEX.test(originalEntryId)) {
    return { success: false, error: "Invalid entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Fetch original entry — verify it exists, is validated, is 'standard' type, and owned by user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: original, error: fetchError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, process_id, entry_type, status, created_by")
    .eq("id", originalEntryId)
    .single();

  if (fetchError || !original) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  if (original.created_by !== session.id) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (original.status !== "validated") {
    return { success: false, error: "Can only correct validated entries", code: "VALIDATION_FAILED" };
  }

  if (original.entry_type === "correction") {
    return { success: false, error: "Cannot correct a correction entry", code: "VALIDATION_FAILED" };
  }

  // Insert new correction entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_production_entries")
    .insert({
      process_id: original.process_id,
      production_date: new Date().toISOString().split("T")[0],
      status: "draft",
      entry_type: "correction",
      corrects_entry_id: originalEntryId,
      created_by: session.id,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message, code: "INSERT_FAILED" };
  }

  // Auto-populate inputs: add the original entry's output packages as inputs to the correction
  // This lets the user delete rows they don't need to correct and keep the ones to fix.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outputPackages } = await (supabase as any)
    .from("inventory_packages")
    .select("id, pieces, volume_m3")
    .eq("production_entry_id", originalEntryId)
    .neq("status", "consumed");

  if (outputPackages && outputPackages.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputRows = outputPackages.map((pkg: any) => ({
      production_entry_id: data.id,
      package_id: pkg.id,
      pieces_used: pkg.pieces ? parseInt(pkg.pieces, 10) || null : null,
      volume_m3: Number(pkg.volume_m3) || 0,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: inputsError } = await (supabase as any)
      .from("portal_production_inputs")
      .insert(inputRows);

    if (inputsError) {
      // Entry was created successfully but inputs couldn't be pre-populated.
      // User can still add inputs manually — log for debugging.
      console.error("Failed to auto-populate correction inputs:", inputsError.message);
    }
  }

  return { success: true, data: { id: data.id } };
}
