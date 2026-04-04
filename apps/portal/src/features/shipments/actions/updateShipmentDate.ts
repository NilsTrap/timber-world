"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Update Shipment Date
 *
 * Allows the shipment owner or incoming receiver to change the date on a draft shipment.
 */
export async function updateShipmentDate(
  shipmentId: string,
  date: string
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, error: "Invalid date format", code: "VALIDATION_FAILED" };
  }

  const supabase = await createClient();

  // Fetch shipment to verify ownership and status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: fetchError } = await (supabase as any)
    .from("shipments")
    .select("id, status, from_organisation_id, to_organisation_id")
    .eq("id", shipmentId)
    .single();

  if (fetchError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  if (shipment.status !== "draft") {
    return { success: false, error: "Only draft shipments can be edited", code: "FORBIDDEN" };
  }

  const isOwner = shipment.from_organisation_id === session.organisationId;
  const isReceiver = shipment.to_organisation_id === session.organisationId;

  if (!isOwner && !isReceiver) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("shipments")
    .update({ shipment_date: date })
    .eq("id", shipmentId);

  if (updateError) {
    return { success: false, error: "Failed to update date", code: "QUERY_FAILED" };
  }

  return { success: true, data: null };
}
