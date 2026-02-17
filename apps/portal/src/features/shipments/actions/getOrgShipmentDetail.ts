"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult, ShipmentDetail, PackageDetail, ShipmentPallet, ShipmentStatus } from "../types";

interface OrgShipmentDetailResult {
  shipment: ShipmentDetail;
  isOwner: boolean;
  isReceiver: boolean;
  isFromExternal: boolean;
}

/**
 * Get Organization Shipment Detail
 *
 * Fetches a single shipment with all packages.
 * Returns whether the current user is the owner (sender) or receiver.
 */
export async function getOrgShipmentDetail(
  shipmentId: string
): Promise<ActionResult<OrgShipmentDetailResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // Fetch shipment with organisation info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .select(`
      id,
      shipment_code,
      shipment_number,
      from_organisation_id,
      to_organisation_id,
      shipment_date,
      transport_cost_eur,
      notes,
      status,
      submitted_at,
      reviewed_at,
      reviewed_by,
      rejection_reason,
      completed_at,
      from_organisation:organisations!shipments_from_party_id_fkey(code, name, is_external),
      to_organisation:organisations!shipments_to_party_id_fkey(code, name),
      reviewer:portal_users!shipments_reviewed_by_fkey(name)
    `)
    .eq("id", shipmentId)
    .single();

  if (shipmentError) {
    console.error("Failed to fetch shipment:", shipmentError);
    if (shipmentError.code === "PGRST116") {
      return { success: false, error: "Shipment not found", code: "NOT_FOUND" };
    }
    return { success: false, error: `Failed to fetch shipment: ${shipmentError.message}`, code: "QUERY_FAILED" };
  }

  // Check access: user must be owner or receiver (or admin for existing shipments)
  const isOwner = shipment.from_organisation_id === session.organisationId;
  const isReceiver = shipment.to_organisation_id === session.organisationId;
  const isSuperAdmin = !session.organisationId;

  if (!isOwner && !isReceiver && !isSuperAdmin) {
    return { success: false, error: "Access denied", code: "FORBIDDEN" };
  }

  // Fetch pallets for this shipment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pallets, error: palletsError } = await (supabase as any)
    .from("shipment_pallets")
    .select("id, pallet_number, notes")
    .eq("shipment_id", shipmentId)
    .order("pallet_number", { ascending: true });

  if (palletsError) {
    console.error("Failed to fetch pallets:", palletsError);
    return { success: false, error: `Failed to fetch pallets: ${palletsError.message}`, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const palletDetails: ShipmentPallet[] = (pallets as any[]).map((p: any) => ({
    id: p.id,
    palletNumber: p.pallet_number,
    notes: p.notes ?? null,
  }));

  // Fetch packages with all reference joins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packages, error: packagesError } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      package_sequence,
      pallet_id,
      product_name_id,
      wood_species_id,
      humidity_id,
      type_id,
      processing_id,
      fsc_id,
      quality_id,
      thickness,
      width,
      length,
      pieces,
      volume_m3,
      volume_is_calculated,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .eq("shipment_id", shipmentId)
    .order("package_sequence", { ascending: true });

  if (packagesError) {
    console.error("Failed to fetch packages:", packagesError);
    return { success: false, error: `Failed to fetch packages: ${packagesError.message}`, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packageDetails: PackageDetail[] = (packages as any[]).map((pkg: any) => ({
    id: pkg.id,
    packageNumber: pkg.package_number,
    packageSequence: pkg.package_sequence,
    productNameId: pkg.product_name_id,
    productName: pkg.ref_product_names?.value ?? null,
    woodSpeciesId: pkg.wood_species_id,
    woodSpecies: pkg.ref_wood_species?.value ?? null,
    humidityId: pkg.humidity_id,
    humidity: pkg.ref_humidity?.value ?? null,
    typeId: pkg.type_id,
    typeName: pkg.ref_types?.value ?? null,
    processingId: pkg.processing_id,
    processing: pkg.ref_processing?.value ?? null,
    fscId: pkg.fsc_id,
    fsc: pkg.ref_fsc?.value ?? null,
    qualityId: pkg.quality_id,
    quality: pkg.ref_quality?.value ?? null,
    thickness: pkg.thickness,
    width: pkg.width,
    length: pkg.length,
    pieces: pkg.pieces,
    volumeM3: pkg.volume_m3 != null ? Number(pkg.volume_m3) : null,
    volumeIsCalculated: pkg.volume_is_calculated ?? false,
    palletId: pkg.pallet_id ?? null,
  }));

  const result: ShipmentDetail = {
    id: shipment.id,
    shipmentCode: shipment.shipment_code,
    shipmentNumber: shipment.shipment_number,
    fromOrganisationId: shipment.from_organisation_id,
    fromOrganisationName: shipment.from_organisation?.name ?? "",
    toOrganisationId: shipment.to_organisation_id,
    toOrganisationName: shipment.to_organisation?.name ?? "",
    shipmentDate: shipment.shipment_date,
    transportCostEur: shipment.transport_cost_eur != null ? Number(shipment.transport_cost_eur) : null,
    notes: shipment.notes ?? null,
    status: (shipment.status ?? "completed") as ShipmentStatus,
    submittedAt: shipment.submitted_at ?? null,
    reviewedAt: shipment.reviewed_at ?? null,
    reviewedBy: shipment.reviewed_by ?? null,
    reviewedByName: shipment.reviewer?.name ?? null,
    rejectionReason: shipment.rejection_reason ?? null,
    completedAt: shipment.completed_at ?? null,
    packages: packageDetails,
    pallets: palletDetails,
  };

  const isFromExternal = shipment.from_organisation?.is_external ?? false;

  return {
    success: true,
    data: {
      shipment: result,
      isOwner,
      isReceiver,
      isFromExternal,
    },
  };
}
