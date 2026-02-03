"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { isValidUUID } from "../types";
import type { ActionResult } from "../types";

/**
 * Get Shipment Code Preview
 *
 * Previews the auto-generated shipment code for selected from/to organisations.
 * Calculates the code based on organisation codes and existing shipment count.
 * Available to any authenticated user.
 */
export async function getShipmentCodePreview(
  fromOrganisationId: string,
  toOrganisationId: string
): Promise<ActionResult<{ code: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isValidUUID(fromOrganisationId) || !isValidUUID(toOrganisationId)) {
    return { success: false, error: "Invalid organisation ID", code: "INVALID_ID" };
  }

  if (fromOrganisationId === toOrganisationId) {
    return { success: false, error: "From and To organisations must be different", code: "SAME_ORGANISATION" };
  }

  const supabase = await createClient();

  // Get organisation codes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fromOrg, error: fromError } = await (supabase as any)
    .from("organisations")
    .select("code")
    .eq("id", fromOrganisationId)
    .single();

  if (fromError || !fromOrg?.code) {
    return { success: false, error: "Source organisation not found", code: "ORG_NOT_FOUND" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: toOrg, error: toError } = await (supabase as any)
    .from("organisations")
    .select("code")
    .eq("id", toOrganisationId)
    .single();

  if (toError || !toOrg?.code) {
    return { success: false, error: "Destination organisation not found", code: "ORG_NOT_FOUND" };
  }

  // Count existing shipments between these organisations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error: countError } = await (supabase as any)
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("from_organisation_id", fromOrganisationId)
    .eq("to_organisation_id", toOrganisationId);

  if (countError) {
    console.error("Failed to count shipments:", countError);
    return { success: false, error: "Failed to generate shipment code", code: "COUNT_FAILED" };
  }

  // Generate code: FROM-TO-001
  const sequenceNumber = String((count ?? 0) + 1).padStart(3, "0");
  const code = `${fromOrg.code}-${toOrg.code}-${sequenceNumber}`;

  return { success: true, data: { code } };
}
