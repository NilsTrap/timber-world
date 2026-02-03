"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult } from "../types";

/** Package with IDs for creating shipment rows */
export interface ShipmentAvailablePackage {
  id: string;
  packageNumber: string;
  shipmentCode: string;
  productNameId: string | null;
  productName: string | null;
  woodSpeciesId: string | null;
  woodSpecies: string | null;
  humidityId: string | null;
  humidity: string | null;
  typeId: string | null;
  typeName: string | null;
  processingId: string | null;
  processing: string | null;
  fscId: string | null;
  fsc: string | null;
  qualityId: string | null;
  quality: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  notes: string | null;
}

/**
 * Get Shipment Available Packages
 *
 * Fetches all inventory packages available for shipping from the producer's facility.
 * Returns packages with both IDs and display values for populating shipment form.
 * Only includes packages with status 'available' or 'produced' (not consumed/shipped).
 * Producer only.
 */
export async function getShipmentAvailablePackages(): Promise<ActionResult<ShipmentAvailablePackage[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isProducer(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const orgId = session.currentOrganizationId || session.organisationId;

  if (!orgId) {
    return { success: false, error: "Your account is not linked to a facility. Contact Admin.", code: "NO_ORGANISATION_LINK" };
  }

  const supabase = await createClient();

  // Query 1: Shipment-sourced packages (shipped to this producer's facility)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shipmentData, error: shipmentError } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      shipment_id,
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
      status,
      notes,
      shipments!inner!inventory_packages_shipment_id_fkey(shipment_code, to_organisation_id),
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .eq("shipments.to_organisation_id", orgId)
    .in("status", ["available", "produced"])
    .order("package_number", { ascending: true });

  if (shipmentError) {
    console.error("Failed to fetch shipment packages:", shipmentError);
    return { success: false, error: `Failed to fetch packages: ${shipmentError.message}`, code: "QUERY_FAILED" };
  }

  // Query 2: Production-sourced packages (from this producer's organisation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: productionData, error: productionError } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      shipment_id,
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
      status,
      notes,
      portal_production_entries!inner(organisation_id),
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .eq("portal_production_entries.organisation_id", orgId)
    .eq("status", "produced")
    .order("package_number", { ascending: true });

  if (productionError) {
    console.error("Failed to fetch production packages:", productionError);
  }

  // Query 3: Direct inventory packages (admin-added, no shipment or production source)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: directData, error: directError } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      shipment_id,
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
      status,
      notes,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .eq("organisation_id", orgId)
    .is("shipment_id", null)
    .is("production_entry_id", null)
    .in("status", ["available", "produced"])
    .order("package_number", { ascending: true });

  if (directError) {
    console.error("Failed to fetch direct packages:", directError);
  }

  // Merge and deduplicate
  const allData = [...(shipmentData ?? []), ...(productionData ?? []), ...(directData ?? [])];
  const seenIds = new Set<string>();
  const uniqueData = allData.filter((pkg: { id: string }) => {
    if (seenIds.has(pkg.id)) return false;
    seenIds.add(pkg.id);
    return true;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: ShipmentAvailablePackage[] = uniqueData.map((pkg: any) => ({
    id: pkg.id,
    packageNumber: pkg.package_number,
    shipmentCode: pkg.shipments?.shipment_code ?? "",
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
    notes: pkg.notes ?? null,
  }));

  packages.sort((a, b) => (a.packageNumber ?? "").localeCompare(b.packageNumber ?? ""));

  return { success: true, data: packages };
}
