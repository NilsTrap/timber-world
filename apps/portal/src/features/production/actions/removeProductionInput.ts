"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Remove Production Input
 *
 * Deletes an input line by ID from portal_production_inputs.
 * Changes are staged until the entry is validated via validateProduction.
 */
export async function removeProductionInput(
  inputId: string
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const isAdmin = isSuperAdmin(session);
  if (!isProducer(session) && !isAdmin) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!inputId || !UUID_REGEX.test(inputId)) {
    return { success: false, error: "Invalid input ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Fetch input with package data to verify ownership and get values for restoration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: input, error: fetchError } = await (supabase as any)
    .from("portal_production_inputs")
    .select("id, production_entry_id, package_id, pieces_used, volume_m3")
    .eq("id", inputId)
    .single();

  if (fetchError || !input) {
    return { success: false, error: "Input not found", code: "NOT_FOUND" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: entryError } = await (supabase as any)
    .from("portal_production_entries")
    .select("created_by, status")
    .eq("id", input.production_entry_id)
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

  // Delete the input
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("portal_production_inputs")
    .delete()
    .eq("id", inputId);

  if (error) {
    console.error("Failed to remove production input:", error);
    return { success: false, error: `Failed to remove input: ${error.message}`, code: "DELETE_FAILED" };
  }

  return { success: true, data: null };
}
