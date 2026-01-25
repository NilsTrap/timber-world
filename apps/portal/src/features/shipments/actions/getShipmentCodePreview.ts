"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { isValidUUID } from "../types";
import type { ActionResult } from "../types";

/**
 * Get Shipment Code Preview
 *
 * Previews the auto-generated shipment code for selected from/to organisations.
 * Calls the `generate_shipment_code` DB function.
 * Admin only.
 */
export async function getShipmentCodePreview(
  fromOrganisationId: string,
  toOrganisationId: string
): Promise<ActionResult<{ code: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!isValidUUID(fromOrganisationId) || !isValidUUID(toOrganisationId)) {
    return { success: false, error: "Invalid organisation ID", code: "INVALID_ID" };
  }

  if (fromOrganisationId === toOrganisationId) {
    return { success: false, error: "From and To organisations must be different", code: "SAME_ORGANISATION" };
  }

  const supabase = await createClient();

  // Call the DB function to generate the shipment code preview
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc("generate_shipment_code", {
      p_from_organisation_id: fromOrganisationId,
      p_to_organisation_id: toOrganisationId,
    });

  if (error) {
    console.error("Failed to generate shipment code:", error);
    return { success: false, error: "Failed to generate shipment code", code: "RPC_FAILED" };
  }

  return { success: true, data: { code: data as string } };
}
