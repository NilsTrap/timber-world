"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult, EditablePackageItem } from "@/features/shipments/types";

/**
 * Get Editable Packages
 *
 * Fetches all inventory packages with both IDs and resolved names for admin editing.
 * Includes reference IDs needed for dropdown editing.
 * Super Admin only.
 *
 * @param orgId - Optional org ID to filter by specific organisation
 */
export async function getEditablePackages(orgId?: string): Promise<ActionResult<EditablePackageItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Query all packages with both IDs and resolved names
  // Exclude consumed packages (status = 'consumed')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packagesData, error: packagesError } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      package_number,
      shipment_id,
      production_entry_id,
      organisation_id,
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
      notes,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .neq("status", "consumed")
    .order("package_number", { ascending: true });

  if (packagesError) {
    console.error("Failed to fetch packages:", packagesError);
    return { success: false, error: `Failed to fetch packages: ${packagesError.message}`, code: "QUERY_FAILED" };
  }

  // Fetch shipments separately to reliably get shipment codes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shipmentIds = [...new Set((packagesData as any[] || [])
    .map((pkg) => pkg.shipment_id)
    .filter(Boolean))];

  const shipmentsMap = new Map<string, string>();
  if (shipmentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shipmentsData, error: shipmentsError } = await (supabase as any)
      .from("shipments")
      .select("id, shipment_code")
      .in("id", shipmentIds);

    if (shipmentsError) {
      console.error("Failed to fetch shipments:", shipmentsError);
    } else if (shipmentsData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const shipment of shipmentsData as any[]) {
        shipmentsMap.set(shipment.id, shipment.shipment_code);
      }
    }
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

  // Map packages with IDs and display values
  // Organisation ID is now directly on the package
  // Shipment code comes from separate shipments query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPackages = (packagesData as any[]).map((pkg: any) => {
    const organisationId = pkg.organisation_id;
    const org = organisationId ? orgsMap.get(organisationId) : null;
    const shipmentCode = pkg.shipment_id ? (shipmentsMap.get(pkg.shipment_id) ?? "") : "";

    return {
      id: pkg.id,
      packageNumber: pkg.package_number,
      shipmentCode,
      shipmentId: pkg.shipment_id,
      // IDs for editing
      organisationId,
      productNameId: pkg.product_name_id,
      woodSpeciesId: pkg.wood_species_id,
      humidityId: pkg.humidity_id,
      typeId: pkg.type_id,
      processingId: pkg.processing_id,
      fscId: pkg.fsc_id,
      qualityId: pkg.quality_id,
      // Display values
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
      volumeIsCalculated: pkg.volume_is_calculated ?? false,
      organisationName: org?.name ?? null,
      organisationCode: org?.code ?? null,
      notes: pkg.notes ?? null,
    };
  });

  // Filter by orgId if specified
  let packages: EditablePackageItem[];
  if (orgId) {
    packages = allPackages.filter((pkg) => pkg.organisationId === orgId);
  } else {
    packages = allPackages;
  }

  return { success: true, data: packages };
}
