"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Save invoice number for a production entry.
 * Users can only update entries from their own organisation.
 * Super Admin can update any entry.
 */
export async function saveInvoiceNumber(
  entryId: string,
  invoiceNumber: string | null
): Promise<ActionResult<{ invoiceNumber: string | null }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  // Validate UUID
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(entryId)) {
    return { success: false, error: "Invalid entry ID", code: "INVALID_INPUT" };
  }

  // Sanitize invoice number (trim, max 100 chars)
  const sanitizedInvoice = invoiceNumber?.trim().slice(0, 100) || null;

  const supabase = await createClient();

  // Check if the entry exists and belongs to user's organisation (for non-super-admin)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: fetchError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, organisation_id")
    .eq("id", entryId)
    .single();

  if (fetchError || !entry) {
    return { success: false, error: "Entry not found", code: "NOT_FOUND" };
  }

  // Check organisation access for non-super-admin
  if (isOrganisationUser(session) && entry.organisation_id !== session.organisationId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Super Admin can update any entry
  if (!isOrganisationUser(session) && !isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Update the invoice number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("portal_production_entries")
    .update({ invoice_number: sanitizedInvoice })
    .eq("id", entryId);

  if (updateError) {
    console.error("Failed to save invoice number:", updateError);
    return { success: false, error: "Failed to save invoice number", code: "UPDATE_FAILED" };
  }

  return { success: true, data: { invoiceNumber: sanitizedInvoice } };
}
