"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult } from "../types";
import type { PackageListItem } from "@/features/shipments/types";

/**
 * Get Available Packages for Production Input
 *
 * Fetches inventory packages at the producer's facility,
 * excluding packages already added as inputs to the given production entry.
 */
export async function getAvailablePackages(
  productionEntryId: string
): Promise<ActionResult<PackageListItem[]>> {
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

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid production entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Get packages already used as inputs in this entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingInputs, error: inputsError } = await (supabase as any)
    .from("portal_production_inputs")
    .select("package_id")
    .eq("production_entry_id", productionEntryId);

  if (inputsError) {
    console.error("Failed to fetch existing inputs:", inputsError);
    return { success: false, error: `Failed to fetch inputs: ${inputsError.message}`, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usedPackageIds = (existingInputs as any[]).map((i: any) => i.package_id);

  // Fetch all packages at producer's facility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
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

  // Exclude packages already used in this entry
  if (usedPackageIds.length > 0) {
    query = query.not("id", "in", `(${usedPackageIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch available packages:", error);
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
