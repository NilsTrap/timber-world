"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult, PackageInput } from "@/features/shipments/types";

interface CreateAdminInventoryInput {
  toOrganisationId: string;
  packages: PackageInput[];
}

interface CreateAdminInventoryResult {
  packageCount: number;
}

/**
 * Create Admin Inventory
 *
 * Adds inventory packages directly to an organization without creating shipments.
 * Packages are inserted directly into inventory_packages with shipment_id = NULL.
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

  const { toOrganisationId, packages } = input;

  if (!toOrganisationId) {
    return { success: false, error: "Destination organization is required", code: "VALIDATION_FAILED" };
  }

  if (!packages || packages.length === 0) {
    return { success: false, error: "At least one package is required", code: "VALIDATION_FAILED" };
  }

  const supabase = await createClient();

  // Insert packages directly into inventory (no shipment)
  const packagesToInsert = packages.map((pkg, index) => ({
    shipment_id: null, // No shipment for admin-added packages
    package_number: pkg.packageNumber || `PKG-${Date.now()}-${index + 1}`,
    organisation_id: toOrganisationId,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("inventory_packages")
    .insert(packagesToInsert);

  if (error) {
    console.error("Failed to create admin inventory:", error);
    return { success: false, error: `Failed to create inventory: ${error.message}`, code: "INSERT_FAILED" };
  }

  return {
    success: true,
    data: {
      packageCount: packages.length,
    },
  };
}
