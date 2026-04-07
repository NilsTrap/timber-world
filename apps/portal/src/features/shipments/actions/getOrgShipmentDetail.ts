"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult, ShipmentDetail, PackageDetail, ShipmentPallet, ShipmentStatus } from "../types";

interface OrgShipmentDetailResult {
  shipment: ShipmentDetail;
  isOwner: boolean;
  isReceiver: boolean;
  isFromExternal: boolean;
  /** Sequence number of this incoming shipment among all incoming shipments to the receiving org */
  incomingSeq: number | null;
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
      created_at,
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
      delivery_from_text,
      delivery_to_text,
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

  // Compute incoming shipment sequence (position among all incoming shipments to this org from external sources)
  let incomingSeq: number | null = null;
  if (shipment.from_organisation?.is_external) {
    // Get all external org IDs that are trading partners
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: extOrgs } = await (supabase as any)
      .from("organisations")
      .select("id")
      .eq("is_external", true);

    const extOrgIds = (extOrgs ?? []).map((o: { id: string }) => o.id);

    if (extOrgIds.length > 0) {
      // Count incoming shipments to this org from external sources with lower shipment_number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: incomingCount } = await (supabase as any)
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .eq("to_organisation_id", shipment.to_organisation_id)
        .in("from_organisation_id", extOrgIds)
        .lt("shipment_number", shipment.shipment_number);

      incomingSeq = (incomingCount ?? 0) + 1;
    } else {
      incomingSeq = 1;
    }
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
  // For completed incoming shipments, also include packages that have this as source_shipment_id
  // (packages may have been sent out in another shipment but should still show in history)
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
    .or(`shipment_id.eq.${shipmentId},source_shipment_id.eq.${shipmentId}`)
    .order("package_sequence", { ascending: true });

  if (packagesError) {
    console.error("Failed to fetch packages:", packagesError);
    return { success: false, error: `Failed to fetch packages: ${packagesError.message}`, code: "QUERY_FAILED" };
  }

  // Recover original shipment values: current DB values may have been
  // decremented by production consumption. Original = current + sum of deductions.
  const allPackageIds = (packages as { id: string }[]).map((p) => p.id);

  const deductionsMap = new Map<string, { pieces: number; volumeM3: number }>();
  if (allPackageIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inputsData } = await (supabase as any)
      .from("portal_production_inputs")
      .select("package_id, pieces_used, volume_m3")
      .in("package_id", allPackageIds);

    if (inputsData) {
      for (const input of inputsData as { package_id: string; pieces_used: number | null; volume_m3: number | null }[]) {
        const existing = deductionsMap.get(input.package_id);
        deductionsMap.set(input.package_id, {
          pieces: (existing?.pieces ?? 0) + (input.pieces_used ?? 0),
          volumeM3: (existing?.volumeM3 ?? 0) + (Number(input.volume_m3) || 0),
        });
      }
    }
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
    pieces: (() => {
      const deduction = deductionsMap.get(pkg.id);
      if (!deduction) return pkg.pieces;
      const currentPieces = pkg.pieces != null ? Number(pkg.pieces) : 0;
      return String(currentPieces + deduction.pieces);
    })(),
    volumeM3: (() => {
      const deduction = deductionsMap.get(pkg.id);
      if (!deduction) return pkg.volume_m3 != null ? Number(pkg.volume_m3) : null;
      const currentVol = pkg.volume_m3 != null ? Number(pkg.volume_m3) : 0;
      return currentVol + deduction.volumeM3;
    })(),
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
    toOrganisationCode: shipment.to_organisation?.code ?? "",
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
    deliveryFromText: shipment.delivery_from_text ?? null,
    deliveryToText: shipment.delivery_to_text ?? null,
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
      incomingSeq,
    },
  };
}
