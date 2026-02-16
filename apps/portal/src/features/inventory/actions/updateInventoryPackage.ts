"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "@/features/shipments/types";

interface UpdatePackageInput {
  id: string;
  packageNumber?: string;
  productNameId?: string | null;
  woodSpeciesId?: string | null;
  humidityId?: string | null;
  typeId?: string | null;
  processingId?: string | null;
  fscId?: string | null;
  qualityId?: string | null;
  thickness?: string | null;
  width?: string | null;
  length?: string | null;
  pieces?: string | null;
  volumeM3?: number | null;
  volumeIsCalculated?: boolean;
}

/**
 * Update Inventory Package
 *
 * Updates a single inventory package. Super Admin only.
 */
export async function updateInventoryPackage(
  input: UpdatePackageInput
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const { id, ...updates } = input;

  if (!id) {
    return { success: false, error: "Package ID is required", code: "VALIDATION_FAILED" };
  }

  const supabase = await createClient();

  // Build update object with snake_case keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if (updates.packageNumber !== undefined) updateData.package_number = updates.packageNumber;
  if (updates.productNameId !== undefined) updateData.product_name_id = updates.productNameId || null;
  if (updates.woodSpeciesId !== undefined) updateData.wood_species_id = updates.woodSpeciesId || null;
  if (updates.humidityId !== undefined) updateData.humidity_id = updates.humidityId || null;
  if (updates.typeId !== undefined) updateData.type_id = updates.typeId || null;
  if (updates.processingId !== undefined) updateData.processing_id = updates.processingId || null;
  if (updates.fscId !== undefined) updateData.fsc_id = updates.fscId || null;
  if (updates.qualityId !== undefined) updateData.quality_id = updates.qualityId || null;
  if (updates.thickness !== undefined) updateData.thickness = updates.thickness;
  if (updates.width !== undefined) updateData.width = updates.width;
  if (updates.length !== undefined) updateData.length = updates.length;
  if (updates.pieces !== undefined) updateData.pieces = updates.pieces;
  if (updates.volumeM3 !== undefined) updateData.volume_m3 = updates.volumeM3;
  if (updates.volumeIsCalculated !== undefined) updateData.volume_is_calculated = updates.volumeIsCalculated;

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: "No fields to update", code: "VALIDATION_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("inventory_packages")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Failed to update package:", error);
    return { success: false, error: `Failed to update package: ${error.message}`, code: "UPDATE_FAILED" };
  }

  revalidatePath("/inventory");
  revalidatePath("/admin/inventory");
  revalidatePath("/dashboard");

  return { success: true, data: { id } };
}
