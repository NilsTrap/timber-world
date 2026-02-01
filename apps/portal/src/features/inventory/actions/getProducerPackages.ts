"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer } from "@/lib/auth";
import type { ActionResult, PackageListItem } from "../types";

/**
 * Get Producer Packages
 *
 * Fetches all inventory packages for the producer's linked facility.
 * Includes packages from:
 * 1. Shipments to this organisation
 * 2. Production entries from this organisation
 * 3. Direct inventory (admin-added) for this organisation
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

  // Use currentOrganizationId (Epic 10) with fallback to organisationId (legacy)
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
      thickness,
      width,
      length,
      pieces,
      volume_m3,
      status,
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
    .neq("status", "consumed")
    .order("package_number", { ascending: true });

  if (shipmentError) {
    console.error("Failed to fetch shipment packages:", shipmentError);
    return { success: false, error: `Failed to fetch packages: ${shipmentError.message}`, code: "QUERY_FAILED" };
  }

  // Query 2: Production-sourced packages (from this producer's organisation)
  // Filter by organisation_id on production entries for proper multi-tenant isolation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: productionData, error: productionError } = await (supabase as any)
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
      status,
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
    // Non-fatal: continue with other results
  }

  // Query 3: Direct inventory packages (admin-added, no shipment or production source)
  // These have organisation_id set directly on the package
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: directData, error: directError } = await (supabase as any)
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
      status,
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
    .neq("status", "consumed")
    .order("package_number", { ascending: true });

  if (directError) {
    console.error("Failed to fetch direct packages:", directError);
    // Non-fatal: continue with other results
  }

  // Merge all result sets and deduplicate by id
  const allData = [...(shipmentData ?? []), ...(productionData ?? []), ...(directData ?? [])];
  const seenIds = new Set<string>();
  const uniqueData = allData.filter((pkg: { id: string }) => {
    if (seenIds.has(pkg.id)) return false;
    seenIds.add(pkg.id);
    return true;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: PackageListItem[] = uniqueData.map((pkg: any) => ({
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
      // Producer only sees their own org's packages, so use current org info
      organisationName: session.currentOrganizationName || session.organisationName,
      organisationCode: session.currentOrganizationCode || session.organisationCode,
    }));

  // Sort by package number after merging
  packages.sort((a, b) => (a.packageNumber ?? "").localeCompare(b.packageNumber ?? ""));

  return { success: true, data: packages };
}
