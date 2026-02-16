"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult, ShipmentPallet } from "../types";

/**
 * Create Pallet
 *
 * Creates a new pallet for a draft shipment with the next available pallet number.
 * Only the shipment owner can create pallets.
 */
export async function createPallet(
  shipmentId: string
): Promise<ActionResult<ShipmentPallet>> {
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
    return { success: false, error: "Can only add pallets to draft shipments", code: "NOT_DRAFT" };
  }

  // Get the next pallet number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxPallet } = await (supabase as any)
    .from("shipment_pallets")
    .select("pallet_number")
    .eq("shipment_id", shipmentId)
    .order("pallet_number", { ascending: false })
    .limit(1)
    .single();

  const nextPalletNumber = (maxPallet?.pallet_number ?? 0) + 1;

  // Create the pallet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newPallet, error: createError } = await (supabase as any)
    .from("shipment_pallets")
    .insert({
      shipment_id: shipmentId,
      pallet_number: nextPalletNumber,
    })
    .select("id, pallet_number, notes")
    .single();

  if (createError) {
    console.error("Failed to create pallet:", createError);
    return { success: false, error: "Failed to create pallet", code: "INSERT_FAILED" };
  }

  revalidatePath("/shipments");

  return {
    success: true,
    data: {
      id: newPallet.id,
      palletNumber: newPallet.pallet_number,
      notes: newPallet.notes ?? null,
    },
  };
}

/**
 * Delete Pallet
 *
 * Deletes a pallet. Packages assigned to it become loose (pallet_id = NULL).
 * Only the shipment owner can delete pallets.
 */
export async function deletePallet(
  palletId: string
): Promise<ActionResult<{ deleted: true }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();

  // Get pallet with shipment info to verify access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pallet, error: palletError } = await (supabase as any)
    .from("shipment_pallets")
    .select(`
      id,
      shipment:shipments(id, from_organisation_id, status)
    `)
    .eq("id", palletId)
    .single();

  if (palletError || !pallet) {
    return { success: false, error: "Pallet not found", code: "NOT_FOUND" };
  }

  const shipment = pallet.shipment;
  if (!shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  if (shipment.from_organisation_id !== session.organisationId) {
    return { success: false, error: "Access denied", code: "FORBIDDEN" };
  }

  if (shipment.status !== "draft") {
    return { success: false, error: "Can only delete pallets from draft shipments", code: "NOT_DRAFT" };
  }

  // Delete the pallet (packages will have pallet_id set to NULL via ON DELETE SET NULL)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("shipment_pallets")
    .delete()
    .eq("id", palletId);

  if (deleteError) {
    console.error("Failed to delete pallet:", deleteError);
    return { success: false, error: "Failed to delete pallet", code: "DELETE_FAILED" };
  }

  revalidatePath("/shipments");

  return { success: true, data: { deleted: true } };
}

/**
 * Assign Package to Pallet
 *
 * Assigns a package to a pallet, or makes it loose (palletId = null).
 * Only the shipment owner can assign packages.
 */
export async function assignPackageToPallet(
  packageId: string,
  palletId: string | null
): Promise<ActionResult<{ assigned: true }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();

  // Get package with shipment info to verify access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pkg, error: pkgError } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      shipment_id,
      shipment:shipments(id, from_organisation_id, status)
    `)
    .eq("id", packageId)
    .single();

  if (pkgError || !pkg) {
    return { success: false, error: "Package not found", code: "NOT_FOUND" };
  }

  const shipment = pkg.shipment;
  if (!shipment) {
    return { success: false, error: "Package not in a shipment", code: "NO_SHIPMENT" };
  }

  if (shipment.from_organisation_id !== session.organisationId) {
    return { success: false, error: "Access denied", code: "FORBIDDEN" };
  }

  if (shipment.status !== "draft") {
    return { success: false, error: "Can only assign pallets in draft shipments", code: "NOT_DRAFT" };
  }

  // If assigning to a pallet, verify the pallet belongs to the same shipment
  if (palletId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pallet, error: palletError } = await (supabase as any)
      .from("shipment_pallets")
      .select("id, shipment_id")
      .eq("id", palletId)
      .single();

    if (palletError || !pallet) {
      return { success: false, error: "Pallet not found", code: "PALLET_NOT_FOUND" };
    }

    if (pallet.shipment_id !== pkg.shipment_id) {
      return { success: false, error: "Pallet belongs to a different shipment", code: "WRONG_SHIPMENT" };
    }
  }

  // Update the package's pallet assignment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("inventory_packages")
    .update({ pallet_id: palletId })
    .eq("id", packageId);

  if (updateError) {
    console.error("Failed to assign package to pallet:", updateError);
    return { success: false, error: "Failed to assign package", code: "UPDATE_FAILED" };
  }

  revalidatePath("/shipments");

  return { success: true, data: { assigned: true } };
}
