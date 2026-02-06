"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "@/features/shipments/types";

export interface OnTheWayPackage {
  id: string;
  packageNumber: string;
  shipmentCode: string;
  shipmentId: string;
  fromOrganisationName: string;
  toOrganisationName: string;
  productName: string | null;
  woodSpecies: string | null;
  humidity: string | null;
  typeName: string | null;
  processing: string | null;
  fsc: string | null;
  quality: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
}

/**
 * Get On The Way Packages
 *
 * Fetches all inventory packages that are in shipments with "pending" status (on the way).
 * Super Admin only.
 *
 * @param orgId - Optional org ID to filter by specific organisation (from or to)
 */
export async function getOnTheWayPackages(orgId?: string): Promise<ActionResult<OnTheWayPackage[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Query packages in pending (on the way) shipments
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
      shipments!inner!inventory_packages_shipment_id_fkey(
        id,
        shipment_code,
        from_organisation_id,
        to_organisation_id,
        status
      ),
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .eq("shipments.status", "pending")
    .order("package_number", { ascending: true });

  // Filter by org if specified (either from or to)
  if (orgId) {
    query = query.or(`shipments.from_organisation_id.eq.${orgId},shipments.to_organisation_id.eq.${orgId}`);
  }

  const { data: packagesData, error: packagesError } = await query;

  if (packagesError) {
    console.error("Failed to fetch on-the-way packages:", packagesError);
    return { success: false, error: `Failed to fetch packages: ${packagesError.message}`, code: "QUERY_FAILED" };
  }

  // Get all organisations for lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgsData } = await (supabase as any)
    .from("organisations")
    .select("id, name");

  const orgsMap = new Map<string, string>();
  if (orgsData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const org of orgsData as any[]) {
      orgsMap.set(org.id, org.name);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: OnTheWayPackage[] = (packagesData as any[] || []).map((pkg: any) => ({
    id: pkg.id,
    packageNumber: pkg.package_number,
    shipmentCode: pkg.shipments?.shipment_code ?? "",
    shipmentId: pkg.shipment_id,
    fromOrganisationName: orgsMap.get(pkg.shipments?.from_organisation_id) ?? "",
    toOrganisationName: orgsMap.get(pkg.shipments?.to_organisation_id) ?? "",
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
