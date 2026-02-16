"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult, ShipmentStatus } from "../types";

interface ShipmentResult {
  id: string;
  status: ShipmentStatus;
}

/**
 * Submit Shipment for Acceptance
 *
 * Changes a draft shipment to pending status.
 * Only the shipment owner can submit.
 */
export async function submitShipmentForAcceptance(
  shipmentId: string
): Promise<ActionResult<ShipmentResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();

  // Verify shipment exists, is a draft, and belongs to user's org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .select("id, from_organisation_id, status")
    .eq("id", shipmentId)
    .single();

  if (shipmentError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  if (shipment.from_organisation_id !== session.organisationId) {
    return { success: false, error: "Access denied", code: "FORBIDDEN" };
  }

  if (shipment.status !== "draft") {
    return { success: false, error: "Can only submit draft shipments", code: "NOT_DRAFT" };
  }

  // Check that shipment has at least one package
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error: countError } = await (supabase as any)
    .from("inventory_packages")
    .select("id", { count: "exact", head: true })
    .eq("shipment_id", shipmentId);

  if (countError) {
    console.error("Failed to count packages:", countError);
    return { success: false, error: "Failed to verify packages", code: "COUNT_FAILED" };
  }

  if ((count ?? 0) === 0) {
    return { success: false, error: "At least one package is required", code: "NO_PACKAGES" };
  }

  // Update shipment status to pending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = await (supabase as any)
    .from("shipments")
    .update({
      status: "pending",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", shipmentId)
    .select("id, status")
    .single();

  if (updateError) {
    console.error("Failed to submit shipment:", updateError);
    return { success: false, error: "Failed to submit shipment", code: "UPDATE_FAILED" };
  }

  revalidatePath("/shipments");
  revalidatePath("/inventory");

  return {
    success: true,
    data: {
      id: updated.id,
      status: updated.status as ShipmentStatus,
    },
  };
}

/**
 * Cancel Shipment Submission
 *
 * Returns a pending shipment back to draft status.
 * Only the shipment owner can cancel.
 */
export async function cancelShipmentSubmission(
  shipmentId: string
): Promise<ActionResult<ShipmentResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();

  // Verify shipment exists, is pending, and belongs to user's org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .select("id, from_organisation_id, status")
    .eq("id", shipmentId)
    .single();

  if (shipmentError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  if (shipment.from_organisation_id !== session.organisationId) {
    return { success: false, error: "Access denied", code: "FORBIDDEN" };
  }

  if (shipment.status !== "pending") {
    return { success: false, error: "Can only cancel pending shipments", code: "NOT_PENDING" };
  }

  // Update shipment status back to draft
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = await (supabase as any)
    .from("shipments")
    .update({
      status: "draft",
      submitted_at: null,
    })
    .eq("id", shipmentId)
    .select("id, status")
    .single();

  if (updateError) {
    console.error("Failed to cancel submission:", updateError);
    return { success: false, error: "Failed to cancel submission", code: "UPDATE_FAILED" };
  }

  revalidatePath("/shipments");
  revalidatePath("/inventory");

  return {
    success: true,
    data: {
      id: updated.id,
      status: updated.status as ShipmentStatus,
    },
  };
}
