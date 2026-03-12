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
 * Get Portal User ID for current session
 * Maps auth_user_id to portal_users.id for FK references
 */
async function getPortalUserId(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, authUserId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("portal_users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  return data?.id ?? null;
}

/**
 * Accept Shipment
 *
 * Accepts a pending shipment and transfers inventory to the receiver's organization.
 * Only the destination organization can accept.
 *
 * Uses a two-phase approach with rollback on failure to maintain data consistency.
 */
export async function acceptShipment(
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

  // Verify shipment exists, is pending, and user is the receiver
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .select("id, to_organisation_id, from_organisation_id, status")
    .eq("id", shipmentId)
    .single();

  if (shipmentError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  if (shipment.to_organisation_id !== session.organisationId) {
    return { success: false, error: "Access denied", code: "FORBIDDEN" };
  }

  if (shipment.status !== "pending") {
    return { success: false, error: "Can only accept pending shipments", code: "NOT_PENDING" };
  }

  // Get the portal_users.id for the current user (for reviewed_by FK)
  const portalUserId = await getPortalUserId(supabase, session.id);

  const now = new Date().toISOString();
  const receiverOrgId = session.organisationId;

  // Phase 1: Transfer packages to receiver's organization FIRST
  // This is the more critical operation - if it fails, shipment stays pending
  //
  // We must handle package_number collisions: the receiver org may already have
  // packages with the same package_number (unique constraint on org+package_number).
  // Strategy: fetch shipment packages, find collisions, renumber before transferring.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipmentPackages, error: fetchPkgError } = await (supabase as any)
    .from("inventory_packages")
    .select("id, package_number")
    .eq("shipment_id", shipmentId);

  if (fetchPkgError || !shipmentPackages) {
    console.error("Failed to fetch shipment packages:", fetchPkgError);
    return { success: false, error: "Failed to transfer inventory", code: "TRANSFER_FAILED" };
  }

  // Find which package_numbers already exist in the receiver's org
  const incomingNumbers = shipmentPackages
    .map((p: { package_number: string | null }) => p.package_number)
    .filter(Boolean) as string[];

  if (incomingNumbers.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("inventory_packages")
      .select("package_number")
      .eq("organisation_id", receiverOrgId)
      .in("package_number", incomingNumbers);

    const existingSet = new Set(
      (existing ?? []).map((r: { package_number: string }) => r.package_number)
    );

    // For colliding packages, get ALL receiver's package numbers to find safe new ones
    if (existingSet.size > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allReceiverPkgs } = await (supabase as any)
        .from("inventory_packages")
        .select("package_number")
        .eq("organisation_id", receiverOrgId)
        .not("package_number", "is", null);

      const allReceiverNumbers = new Set(
        (allReceiverPkgs ?? []).map((r: { package_number: string }) => r.package_number)
      );

      // Renumber colliding packages one by one
      for (const pkg of shipmentPackages as { id: string; package_number: string | null }[]) {
        if (pkg.package_number && existingSet.has(pkg.package_number)) {
          // Find next available number: append -N suffix to original
          let newNumber = pkg.package_number;
          let suffix = 2;
          while (allReceiverNumbers.has(newNumber)) {
            newNumber = `${pkg.package_number}-${suffix}`;
            suffix++;
          }
          allReceiverNumbers.add(newNumber);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: renumberErr } = await (supabase as any)
            .from("inventory_packages")
            .update({ package_number: newNumber })
            .eq("id", pkg.id);

          if (renumberErr) {
            console.error("Failed to renumber package:", renumberErr);
            return { success: false, error: "Failed to transfer inventory", code: "TRANSFER_FAILED" };
          }
        }
      }
    }
  }

  // Now bulk-transfer all packages to the receiver org (no more collisions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updatePackagesError } = await (supabase as any)
    .from("inventory_packages")
    .update({
      organisation_id: receiverOrgId,
    })
    .eq("shipment_id", shipmentId);

  if (updatePackagesError) {
    console.error("Failed to transfer packages:", updatePackagesError);
    return { success: false, error: "Failed to transfer inventory", code: "TRANSFER_FAILED" };
  }

  // Phase 2: Update shipment status to completed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateShipmentError } = await (supabase as any)
    .from("shipments")
    .update({
      status: "completed",
      reviewed_at: now,
      reviewed_by: portalUserId, // Use portal_users.id, not auth_user_id
      completed_at: now,
    })
    .eq("id", shipmentId);

  if (updateShipmentError) {
    console.error("Failed to update shipment status:", updateShipmentError);
    // Rollback: Transfer packages back to sender
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("inventory_packages")
      .update({
        organisation_id: shipment.from_organisation_id,
      })
      .eq("shipment_id", shipmentId);

    return { success: false, error: "Failed to complete shipment acceptance", code: "UPDATE_FAILED" };
  }

  revalidatePath("/shipments");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return {
    success: true,
    data: {
      id: shipmentId,
      status: "completed",
    },
  };
}

/**
 * Reject Shipment
 *
 * Rejects a pending shipment with a reason.
 * Only the destination organization can reject.
 * Packages remain with the sender.
 */
export async function rejectShipment(
  shipmentId: string,
  reason: string
): Promise<ActionResult<ShipmentResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  if (!reason || reason.trim().length === 0) {
    return { success: false, error: "Rejection reason is required", code: "REASON_REQUIRED" };
  }

  const supabase = await createClient();

  // Verify shipment exists, is pending, and user is the receiver
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .select("id, to_organisation_id, status")
    .eq("id", shipmentId)
    .single();

  if (shipmentError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  if (shipment.to_organisation_id !== session.organisationId) {
    return { success: false, error: "Access denied", code: "FORBIDDEN" };
  }

  if (shipment.status !== "pending") {
    return { success: false, error: "Can only reject pending shipments", code: "NOT_PENDING" };
  }

  // Get the portal_users.id for the current user (for reviewed_by FK)
  const portalUserId = await getPortalUserId(supabase, session.id);

  const now = new Date().toISOString();

  // Update shipment status to rejected
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("shipments")
    .update({
      status: "rejected",
      reviewed_at: now,
      reviewed_by: portalUserId, // Use portal_users.id, not auth_user_id
      rejection_reason: reason.trim(),
    })
    .eq("id", shipmentId);

  if (updateError) {
    console.error("Failed to reject shipment:", updateError);
    return { success: false, error: "Failed to reject shipment", code: "UPDATE_FAILED" };
  }

  // Packages remain with the sender - no transfer needed

  revalidatePath("/shipments");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return {
    success: true,
    data: {
      id: shipmentId,
      status: "rejected",
    },
  };
}
