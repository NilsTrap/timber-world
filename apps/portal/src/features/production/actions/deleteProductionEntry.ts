"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete a production entry and all its related inputs/outputs.
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

  // Organisation users can only delete drafts; Super Admin can delete any status
  if (!isSuperAdmin(session) && entry.status !== "draft") {
    return { success: false, error: "Only draft entries can be deleted", code: "VALIDATION_FAILED" };
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

  // For validated entries, check if any output packages are used as inputs elsewhere
  if (entry.status === "validated") {
    // Get packages created by this production entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: packages } = await (supabase as any)
      .from("inventory_packages")
      .select("id")
      .eq("production_entry_id", entryId);

    if (packages && packages.length > 0) {
      const packageIds = packages.map((p: { id: string }) => p.id);

      // Check if any of these packages are used as inputs in OTHER production entries
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: usedInputs } = await (supabase as any)
        .from("portal_production_inputs")
        .select("id, production_entry_id")
        .in("package_id", packageIds)
        .neq("production_entry_id", entryId);

      if (usedInputs && usedInputs.length > 0) {
        return {
          success: false,
          error: "Cannot delete: output packages from this production are used as inputs in other production entries",
          code: "VALIDATION_FAILED",
        };
      }

      // Delete inventory packages created by this production
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: packagesDeleteError } = await (supabase as any)
        .from("inventory_packages")
        .delete()
        .eq("production_entry_id", entryId);

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

  return { success: true, data: null };
}
