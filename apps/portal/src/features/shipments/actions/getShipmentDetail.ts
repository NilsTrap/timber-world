"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult, ShipmentDetail, PackageDetail } from "../types";

/**
 * Get Shipment Detail
 *
 * Fetches a single shipment with all packages and resolved reference names.
 * Admin only.
 */
export async function getShipmentDetail(
  shipmentId: string
): Promise<ActionResult<ShipmentDetail>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Fetch shipment with party info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipment, error: shipmentError } = await (supabase as any)
    .from("shipments")
    .select(`
      id,
      shipment_code,
      shipment_number,
      from_party_id,
      to_party_id,
      shipment_date,
      transport_cost_eur,
      from_party:parties!shipments_from_party_id_fkey(code, name),
      to_party:parties!shipments_to_party_id_fkey(code, name)
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

  // Fetch packages with all reference joins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packages, error: packagesError } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      package_sequence,
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
      ref_product_names(value),
      ref_wood_species(value),
      ref_humidity(value),
      ref_types(value),
      ref_processing(value),
      ref_fsc(value),
      ref_quality(value)
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
  }));

  const result: ShipmentDetail = {
    id: shipment.id,
    shipmentCode: shipment.shipment_code,
    shipmentNumber: shipment.shipment_number,
    fromPartyId: shipment.from_party_id,
    fromPartyName: `${shipment.from_party?.code ?? ""} - ${shipment.from_party?.name ?? ""}`,
    toPartyId: shipment.to_party_id,
    toPartyName: `${shipment.to_party?.code ?? ""} - ${shipment.to_party?.name ?? ""}`,
    shipmentDate: shipment.shipment_date,
    transportCostEur: shipment.transport_cost_eur != null ? Number(shipment.transport_cost_eur) : null,
    packages: packageDetails,
  };

  return { success: true, data: result };
}
