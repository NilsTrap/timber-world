"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer, isSuperAdmin, isOrganisationUser } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Unvalidate a single production output package.
 *
 * Removes the linked inventory_package and clears inventory_package_id
 * on the portal_production_outputs row.
 *
 * Blocked if the inventory package is used as input in any production entry.
 */
export async function unvalidateSingleOutput(
  productionEntryId: string,
  outputId: string
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const isAdmin = isSuperAdmin(session);
  if (!isProducer(session) && !isAdmin) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid entry ID", code: "INVALID_INPUT" };
  }
  if (!outputId || !UUID_REGEX.test(outputId)) {
    return { success: false, error: "Invalid output ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Fetch entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, status, organisation_id, created_by")
    .eq("id", productionEntryId)
    .single();

  if (entryError || !entry) {
    return { success: false, error: "Production entry not found", code: "NOT_FOUND" };
  }

  if (entry.status !== "draft") {
    return { success: false, error: "Can only unvalidate individual outputs from draft entries", code: "VALIDATION_FAILED" };
  }

  // Permission: own org or admin
  if (!isAdmin) {
    const isOwnEntry = entry.created_by === session.id;
    const isOrgEntry = isOrganisationUser(session) && entry.organisation_id === session.organisationId;
    if (!isOwnEntry && !isOrgEntry) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
  }

  // Fetch the output row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: output, error: outputError } = await (supabase as any)
    .from("portal_production_outputs")
    .select("id, inventory_package_id")
    .eq("id", outputId)
    .eq("production_entry_id", productionEntryId)
    .single();

  if (outputError || !output) {
    return { success: false, error: "Output row not found", code: "NOT_FOUND" };
  }

  if (!output.inventory_package_id) {
    return { success: false, error: "This output is not validated", code: "VALIDATION_FAILED" };
  }

  const inventoryPackageId = output.inventory_package_id;

  // Check if the inventory package is used as input in any production entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usedInputs, error: usageError } = await (supabase as any)
    .from("portal_production_inputs")
    .select("id")
    .eq("package_id", inventoryPackageId)
    .limit(1);

  if (usageError) {
    return { success: false, error: `Failed to check usage: ${usageError.message}`, code: "QUERY_FAILED" };
  }

  if (usedInputs && usedInputs.length > 0) {
    return {
      success: false,
      error: "Cannot unvalidate: this package is used as input in another production entry",
      code: "VALIDATION_FAILED",
    };
  }

  // Clear the link on the output row first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: unlinkError } = await (supabase as any)
    .from("portal_production_outputs")
    .update({ inventory_package_id: null })
    .eq("id", outputId);

  if (unlinkError) {
    return {
      success: false,
      error: `Failed to unlink output: ${unlinkError.message}`,
      code: "UPDATE_FAILED",
    };
  }

  // Delete the inventory package
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("inventory_packages")
    .delete()
    .eq("id", inventoryPackageId);

  if (deleteError) {
    // Rollback: re-link the output
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("portal_production_outputs")
      .update({ inventory_package_id: inventoryPackageId })
      .eq("id", outputId);

    return {
      success: false,
      error: `Failed to delete inventory package: ${deleteError.message}`,
      code: "DELETE_FAILED",
    };
  }

  revalidatePath("/production");
  revalidatePath("/inventory");

  return { success: true, data: null };
}
