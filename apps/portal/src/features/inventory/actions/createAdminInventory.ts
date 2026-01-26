"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult, PackageInput } from "@/features/shipments/types";

interface CreateAdminInventoryInput {
  toOrganisationId: string;
  shipmentDate: string;
  shipmentCode: string;
  packages: PackageInput[];
}

interface CreateAdminInventoryResult {
  shipmentId: string;
  shipmentCode: string;
  packageCount: number;
}

/**
 * Create Admin Inventory
 *
 * Adds inventory directly to an organization without a source organization.
 * Creates a shipment with code "ADM-XXX" and from_organisation_id = NULL.
 * Admin only.
 */
export async function createAdminInventory(
  input: CreateAdminInventoryInput
): Promise<ActionResult<CreateAdminInventoryResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const { toOrganisationId, shipmentDate, shipmentCode, packages } = input;

  if (!toOrganisationId) {
    return { success: false, error: "Destination organization is required", code: "VALIDATION_FAILED" };
  }

  if (!shipmentDate) {
    return { success: false, error: "Date is required", code: "VALIDATION_FAILED" };
  }

  if (!shipmentCode) {
    return { success: false, error: "Shipment code is required", code: "VALIDATION_FAILED" };
  }

  if (!packages || packages.length === 0) {
    return { success: false, error: "At least one package is required", code: "VALIDATION_FAILED" };
  }

  const supabase = await createClient();

  // Transform packages to snake_case JSONB for the DB function
  const packagesJsonb = packages.map((pkg) => ({
    package_number: pkg.packageNumber || null,
    product_name_id: pkg.productNameId || null,
    wood_species_id: pkg.woodSpeciesId || null,
    humidity_id: pkg.humidityId || null,
    type_id: pkg.typeId || null,
    processing_id: pkg.processingId || null,
    fsc_id: pkg.fscId || null,
    quality_id: pkg.qualityId || null,
    thickness: pkg.thickness || null,
    width: pkg.width || null,
    length: pkg.length || null,
    pieces: pkg.pieces || null,
    volume_m3: pkg.volumeM3,
    volume_is_calculated: pkg.volumeIsCalculated,
  }));

  // Call the admin inventory creation function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc("create_admin_inventory", {
      p_to_organisation_id: toOrganisationId,
      p_shipment_date: shipmentDate,
      p_shipment_code: shipmentCode,
      p_packages: packagesJsonb,
    });

  if (error) {
    console.error("Failed to create admin inventory:", error);
    return { success: false, error: `Failed to create inventory: ${error.message}`, code: "RPC_FAILED" };
  }

  return {
    success: true,
    data: {
      shipmentId: data.shipment_id,
      shipmentCode: data.shipment_code,
      packageCount: data.package_count,
    },
  };
}
