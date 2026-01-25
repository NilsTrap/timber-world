"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult, PackageListItem } from "../types";

/**
 * Get Packages
 *
 * Fetches all inventory packages with resolved reference names, shipment codes,
 * and organisation information.
 * Used in the Packages tab of the inventory overview.
 * Super Admin only (sees all organisations).
 *
 * Organisation ownership:
 * - Shipment packages: owner = destination org (to_organisation_id)
 * - Production packages: owner = production entry's org (organisation_id)
 *
 * @param orgId - Optional org ID for Super Admin to filter by specific organisation
 */
export async function getPackages(orgId?: string): Promise<ActionResult<PackageListItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Query all packages with shipment info (includes to_organisation_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packagesData, error: packagesError } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      shipment_id,
      production_entry_id,
      thickness,
      width,
      length,
      pieces,
      volume_m3,
      shipments!inventory_packages_shipment_id_fkey(shipment_code, to_organisation_id),
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .order("package_number", { ascending: true });

  if (packagesError) {
    console.error("Failed to fetch packages:", packagesError);
    return { success: false, error: `Failed to fetch packages: ${packagesError.message}`, code: "QUERY_FAILED" };
  }

  // Get all organisations for lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgsData } = await (supabase as any)
    .from("organisations")
    .select("id, code, name");

  const orgsMap = new Map<string, { code: string; name: string }>();
  if (orgsData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const org of orgsData as any[]) {
      orgsMap.set(org.id, { code: org.code, name: org.name });
    }
  }

  // For production packages, get production entry org info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productionPackageIds = (packagesData as any[])
    .filter((pkg) => pkg.production_entry_id && !pkg.shipment_id)
    .map((pkg) => pkg.production_entry_id);

  const productionOrgMap = new Map<string, string>();
  if (productionPackageIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: productionData } = await (supabase as any)
      .from("portal_production_entries")
      .select("id, organisation_id")
      .in("id", productionPackageIds);

    if (productionData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const entry of productionData as any[]) {
        productionOrgMap.set(entry.id, entry.organisation_id);
      }
    }
  }

  // Map packages with correct organisation, optionally filtering by orgId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPackages = (packagesData as any[]).map((pkg: any) => {
    let organisationId: string | null = null;

    if (pkg.shipments?.to_organisation_id) {
      // Shipment package: owner = destination org
      organisationId = pkg.shipments.to_organisation_id;
    } else if (pkg.production_entry_id) {
      // Production package: owner = production entry's org
      organisationId = productionOrgMap.get(pkg.production_entry_id) ?? null;
    }

    const org = organisationId ? orgsMap.get(organisationId) : null;

    return {
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
      organisationName: org?.name ?? null,
      organisationCode: org?.code ?? null,
      _organisationId: organisationId, // Internal field for filtering
    };
  });

  // Filter by orgId if specified (Super Admin with org filter)
  let packages: PackageListItem[];
  if (orgId) {
    packages = allPackages
      .filter((pkg) => pkg._organisationId === orgId)
      .map(({ _organisationId, ...rest }) => rest);
  } else {
    packages = allPackages.map(({ _organisationId, ...rest }) => rest);
  }

  return { success: true, data: packages };
}
