"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "@/features/shipments/types";

interface PackageSaveInput {
  id: string;
  isNew?: boolean;
  packageNumber: string;
  shipmentCode?: string; // User-specified shipment code for new packages
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
 * New packages are created as admin inventory (no shipment).
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

  // Create new packages
  // New packages need a shipment - we'll create an admin shipment for them
  if (newPackages.length > 0) {
    // Group new packages by organisation
    const byOrg = new Map<string, PackageSaveInput[]>();
    for (const pkg of newPackages) {
      const orgId = pkg.organisationId || "unknown";
      if (!byOrg.has(orgId)) {
        byOrg.set(orgId, []);
      }
      byOrg.get(orgId)!.push(pkg);
    }

    // Create packages for each organisation
    for (const [orgId, orgPackages] of byOrg) {
      if (orgId === "unknown") {
        errors.push("Cannot create packages without organisation");
        continue;
      }

      // Use shipment code from first package, default to "-" if empty
      const shipmentCode = orgPackages[0]?.shipmentCode?.trim() || "-";

      // Get next shipment number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: shipmentNum, error: seqError } = await (supabase as any)
        .rpc("get_next_shipment_number");

      if (seqError) {
        errors.push(`Failed to get shipment number: ${seqError.message}`);
        continue;
      }

      // Create shipment for this batch with user-specified code
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: shipmentData, error: shipmentError } = await (supabase as any)
        .from("shipments")
        .insert({
          shipment_code: shipmentCode,
          shipment_number: shipmentNum,
          from_organisation_id: null,
          to_organisation_id: orgId,
          shipment_date: new Date().toISOString().split("T")[0],
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (shipmentError) {
        errors.push(`Failed to create shipment: ${shipmentError.message}`);
        continue;
      }

      // Insert packages
      let sequence = 0;
      for (const pkg of orgPackages) {
        sequence++;
        const packageNumber = pkg.packageNumber || `${shipmentCode}-${shipmentNum}-${String(sequence).padStart(3, "0")}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: pkgError } = await (supabase as any)
          .from("inventory_packages")
          .insert({
            shipment_id: shipmentData.id,
            package_number: packageNumber,
            package_sequence: sequence,
            organisation_id: orgId,
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
    }
  }

  if (errors.length > 0 && updated === 0 && created === 0) {
    return { success: false, error: errors.join("; "), code: "SAVE_FAILED" };
  }

  return { success: true, data: { updated, created, errors } };
}
