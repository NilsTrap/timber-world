"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete a draft production entry and all its related inputs/outputs.
 *
 * Multi-tenancy:
 * - Organisation users can only delete their own organisation's draft entries
 * - Super Admin can delete any draft entry
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

  // Fetch entry — verify it exists, is draft, and owned by user's organisation
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
  // Super Admin can delete any entry

  if (entry.status !== "draft") {
    return { success: false, error: "Only draft entries can be deleted", code: "VALIDATION_FAILED" };
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

  return { success: true, data: null };
}
