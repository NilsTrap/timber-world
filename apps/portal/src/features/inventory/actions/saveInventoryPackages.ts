"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "@/features/shipments/types";

interface PackageSaveInput {
  id: string;
  isNew?: boolean;
  packageNumber: string;
  organisationId: string | null;
  productNameId: string | null;
  woodSpeciesId: string | null;
  humidityId: string | null;
  typeId: string | null;
  processingId: string | null;
  fscId: string | null;
  qualityId: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  volumeIsCalculated: boolean;
}

interface SaveResult {
  updated: number;
  created: number;
  errors: string[];
}

/**
 * Save Inventory Packages (Bulk)
 *
 * Saves multiple inventory packages - updates existing ones and creates new ones.
 * New packages are created directly in inventory without creating shipments.
 * Super Admin only.
 */
export async function saveInventoryPackages(
  packages: PackageSaveInput[]
): Promise<ActionResult<SaveResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!packages || packages.length === 0) {
    return { success: false, error: "No packages to save", code: "VALIDATION_FAILED" };
  }

  const supabase = await createClient();
  const errors: string[] = [];
  let updated = 0;
  let created = 0;

  // Separate new and existing packages
  // Check both isNew flag AND if ID looks like a client-generated ID (starts with "new-")
  const newPackages = packages.filter((p) => p.isNew || p.id.startsWith("new-"));
  const existingPackages = packages.filter((p) => !p.isNew && !p.id.startsWith("new-"));

  // Update existing packages
  for (const pkg of existingPackages) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("inventory_packages")
      .update({
        package_number: pkg.packageNumber,
        organisation_id: pkg.organisationId,
        product_name_id: pkg.productNameId || null,
        wood_species_id: pkg.woodSpeciesId || null,
        humidity_id: pkg.humidityId || null,
        type_id: pkg.typeId || null,
        processing_id: pkg.processingId || null,
        fsc_id: pkg.fscId || null,
        quality_id: pkg.qualityId || null,
        thickness: pkg.thickness,
        width: pkg.width,
        length: pkg.length,
        pieces: pkg.pieces,
        volume_m3: pkg.volumeM3,
        volume_is_calculated: pkg.volumeIsCalculated,
      })
      .eq("id", pkg.id);

    if (error) {
      errors.push(`Failed to update ${pkg.packageNumber}: ${error.message}`);
    } else {
      updated++;
    }
  }

  // Create new packages directly in inventory (no shipment)
  for (const pkg of newPackages) {
    if (!pkg.organisationId) {
      errors.push(`Cannot create package without organisation: ${pkg.packageNumber || "unnamed"}`);
      continue;
    }

    const packageNumber = pkg.packageNumber || `PKG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: pkgError } = await (supabase as any)
      .from("inventory_packages")
      .insert({
        shipment_id: null, // No shipment for admin-added packages
        package_number: packageNumber,
        organisation_id: pkg.organisationId,
        product_name_id: pkg.productNameId || null,
        wood_species_id: pkg.woodSpeciesId || null,
        humidity_id: pkg.humidityId || null,
        type_id: pkg.typeId || null,
        processing_id: pkg.processingId || null,
        fsc_id: pkg.fscId || null,
        quality_id: pkg.qualityId || null,
        thickness: pkg.thickness,
        width: pkg.width,
        length: pkg.length,
        pieces: pkg.pieces,
        volume_m3: pkg.volumeM3,
        volume_is_calculated: pkg.volumeIsCalculated,
      });

    if (pkgError) {
      errors.push(`Failed to create ${packageNumber}: ${pkgError.message}`);
    } else {
      created++;
    }
  }

  if (errors.length > 0 && updated === 0 && created === 0) {
    return { success: false, error: errors.join("; "), code: "SAVE_FAILED" };
  }

  return { success: true, data: { updated, created, errors } };
}
