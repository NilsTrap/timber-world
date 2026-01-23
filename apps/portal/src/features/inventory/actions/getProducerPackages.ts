"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult, PackageListItem } from "../types";

/**
 * Get Producer Packages
 *
 * Fetches all inventory packages for the producer's linked facility.
 * Filters by shipments where to_party_id matches the producer's party_id.
 * Producer only.
 */
export async function getProducerPackages(): Promise<ActionResult<PackageListItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isProducer(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!session.partyId) {
    return { success: false, error: "Your account is not linked to a facility. Contact Admin.", code: "NO_PARTY_LINK" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      shipment_id,
      thickness,
      width,
      length,
      pieces,
      volume_m3,
      shipments!inner!inventory_packages_shipment_id_fkey(shipment_code, to_party_id),
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .eq("shipments.to_party_id", session.partyId)
    .order("package_number", { ascending: true });

  if (error) {
    console.error("Failed to fetch producer packages:", error);
    return { success: false, error: `Failed to fetch packages: ${error.message}`, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: PackageListItem[] = (data as any[]).map((pkg: any) => ({
      id: pkg.id,
      packageNumber: pkg.package_number,
      shipmentCode: pkg.shipments?.shipment_code ?? "",
      shipmentId: pkg.shipment_id,
      productName: pkg.ref_product_names?.value ?? null,
      woodSpecies: pkg.ref_wood_species?.value ?? null,
      humidity: pkg.ref_humidity?.value ?? null,
      typeName: pkg.ref_types?.value ?? null,
      processing: pkg.ref_processing?.value ?? null,
      fsc: pkg.ref_fsc?.value ?? null,
      quality: pkg.ref_quality?.value ?? null,
      thickness: pkg.thickness,
      width: pkg.width,
      length: pkg.length,
      pieces: pkg.pieces,
      volumeM3: pkg.volume_m3 != null ? Number(pkg.volume_m3) : null,
    }));

  return { success: true, data: packages };
}
