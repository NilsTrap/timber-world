"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

interface IncomingPackageInput {
  id: string;
  isNew?: boolean;
  packageNumber: string;
  productNameId: string | null;
  woodSpeciesId: string | null;
  humidityId: string | null;
  typeId: string | null;
  processingId: string | null;
  fscId: string | null;
  qualityId: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  volumeIsCalculated: boolean;
  palletId?: string | null;
}

interface SaveResult {
  updated: number;
  created: number;
  deleted: number;
  errors: string[];
}

/**
 * Save Incoming Shipment Packages
 *
 * Creates, updates, and deletes packages for incoming shipments from external suppliers.
 * This is used when the receiver creates packages from scratch (not selecting from inventory).
 *
 * Access: Receiver of the shipment, shipment must be from an external org, status must be draft.
 */
export async function saveIncomingShipmentPackages(
  shipmentId: string,
  packages: IncomingPackageInput[],
  deletedPackageIds: string[]
): Promise<ActionResult<SaveResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();

  // Verify shipment exists, is a draft, receiver is current user's org, and from external org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .select(`
      id,
      from_organisation_id,
      to_organisation_id,
      status,
      shipment_code,
      from_organisation:organisations!shipments_from_party_id_fkey(is_external)
    `)
    .eq("id", shipmentId)
    .single();

  if (shipmentError || !shipment) {
    return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
  }

  // Check access: current user must be the receiver
  if (shipment.to_organisation_id !== session.organisationId) {
    return { success: false, error: "Access denied - you are not the receiver", code: "FORBIDDEN" };
  }

  // Check that sender is external
  if (!shipment.from_organisation?.is_external) {
    return {
      success: false,
      error: "This action is only for incoming shipments from external suppliers",
      code: "NOT_EXTERNAL",
    };
  }

  // Check status
  if (shipment.status !== "draft") {
    return { success: false, error: "Can only edit packages on draft shipments", code: "NOT_DRAFT" };
  }

  const errors: string[] = [];
  let updated = 0;
  let created = 0;
  let deleted = 0;

  // Separate new and existing packages
  const newPackages = packages.filter((p) => p.isNew || p.id.startsWith("new-"));
  const existingPackages = packages.filter((p) => !p.isNew && !p.id.startsWith("new-"));

  // Get current max sequence in shipment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxSeqData } = await (supabase as any)
    .from("inventory_packages")
    .select("package_sequence")
    .eq("shipment_id", shipmentId)
    .order("package_sequence", { ascending: false })
    .limit(1)
    .single();

  let nextSequence = (maxSeqData?.package_sequence ?? 0) + 1;

  // Delete packages that were removed
  for (const pkgId of deletedPackageIds) {
    // Verify this package belongs to this shipment before deleting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pkg } = await (supabase as any)
      .from("inventory_packages")
      .select("id, shipment_id")
      .eq("id", pkgId)
      .single();

    if (pkg && pkg.shipment_id === shipmentId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from("inventory_packages")
        .delete()
        .eq("id", pkgId);

      if (deleteError) {
        errors.push(`Failed to delete package ${pkgId}: ${deleteError.message}`);
      } else {
        deleted++;
      }
    }
  }

  // Update existing packages
  for (const pkg of existingPackages) {
    // Verify this package belongs to this shipment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingPkg } = await (supabase as any)
      .from("inventory_packages")
      .select("id, shipment_id")
      .eq("id", pkg.id)
      .single();

    if (!existingPkg || existingPkg.shipment_id !== shipmentId) {
      errors.push(`Package ${pkg.packageNumber || pkg.id} not found in this shipment`);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("inventory_packages")
      .update({
        package_number: pkg.packageNumber,
        product_name_id: pkg.productNameId || null,
        wood_species_id: pkg.woodSpeciesId || null,
        humidity_id: pkg.humidityId || null,
        type_id: pkg.typeId || null,
        processing_id: pkg.processingId || null,
        fsc_id: pkg.fscId || null,
        quality_id: pkg.qualityId || null,
        thickness: pkg.thickness,
        width: pkg.width,
        length: pkg.length,
        pieces: pkg.pieces,
        volume_m3: pkg.volumeM3,
        volume_is_calculated: pkg.volumeIsCalculated,
        pallet_id: pkg.palletId || null,
      })
      .eq("id", pkg.id);

    if (error) {
      errors.push(`Failed to update ${pkg.packageNumber || pkg.id}: ${error.message}`);
    } else {
      updated++;
    }
  }

  // Create new packages
  for (const pkg of newPackages) {
    const packageNumber =
      pkg.packageNumber ||
      `${shipment.shipment_code}-${String(nextSequence).padStart(3, "0")}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("inventory_packages")
      .insert({
        shipment_id: shipmentId,
        package_number: packageNumber,
        package_sequence: nextSequence,
        // Packages go to receiver's org (the current user's org)
        organisation_id: session.organisationId,
        product_name_id: pkg.productNameId || null,
        wood_species_id: pkg.woodSpeciesId || null,
        humidity_id: pkg.humidityId || null,
        type_id: pkg.typeId || null,
        processing_id: pkg.processingId || null,
        fsc_id: pkg.fscId || null,
        quality_id: pkg.qualityId || null,
        thickness: pkg.thickness,
        width: pkg.width,
        length: pkg.length,
        pieces: pkg.pieces,
        volume_m3: pkg.volumeM3,
        volume_is_calculated: pkg.volumeIsCalculated,
        pallet_id: pkg.palletId || null,
        status: "available",
      });

    if (insertError) {
      errors.push(`Failed to create ${packageNumber}: ${insertError.message}`);
    } else {
      created++;
      nextSequence++;
    }
  }

  if (errors.length > 0 && updated === 0 && created === 0 && deleted === 0) {
    return { success: false, error: errors.join("; "), code: "SAVE_FAILED" };
  }

  revalidatePath("/shipments");
  revalidatePath(`/shipments/${shipmentId}`);

  return { success: true, data: { updated, created, deleted, errors } };
}
