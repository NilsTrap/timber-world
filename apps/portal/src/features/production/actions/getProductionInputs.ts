"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isProducer, isSuperAdmin } from "@/lib/auth";
import type { ActionResult, ProductionInput } from "../types";

/**
 * Get Production Inputs
 *
 * Fetches all input lines for a production entry with joined package data.
 * Accessible by producers (own organisation) and Super Admin (any organisation).
 */
export async function getProductionInputs(
  productionEntryId: string
): Promise<ActionResult<ProductionInput[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  // Allow producers and Super Admin
  if (!isProducer(session) && !isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!productionEntryId || !UUID_REGEX.test(productionEntryId)) {
    return { success: false, error: "Invalid production entry ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_production_inputs")
    .select(`
      id, pieces_used, volume_m3, created_at,
      inventory_packages!portal_production_inputs_package_id_fkey(
        id, package_number, shipment_id, thickness, width, length, pieces, volume_m3, notes,
        shipments!inventory_packages_shipment_id_fkey(shipment_code),
        ref_product_names!inventory_packages_product_name_id_fkey(value),
        ref_wood_species!inventory_packages_wood_species_id_fkey(value),
        ref_humidity!inventory_packages_humidity_id_fkey(value),
        ref_types!inventory_packages_type_id_fkey(value),
        ref_processing!inventory_packages_processing_id_fkey(value),
        ref_fsc!inventory_packages_fsc_id_fkey(value),
        ref_quality!inventory_packages_quality_id_fkey(value)
      )
    `)
    .eq("production_entry_id", productionEntryId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch production inputs:", error);
    return { success: false, error: `Failed to fetch inputs: ${error.message}`, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputs: ProductionInput[] = (data as any[]).map((row: any) => {
    const pkg = row.inventory_packages;
    return {
      id: row.id,
      productionEntryId,
      packageId: pkg?.id ?? "",
      packageNumber: pkg?.package_number ?? "",
      shipmentCode: pkg?.shipments?.shipment_code ?? "",
      productName: pkg?.ref_product_names?.value ?? null,
      woodSpecies: pkg?.ref_wood_species?.value ?? null,
      humidity: pkg?.ref_humidity?.value ?? null,
      typeName: pkg?.ref_types?.value ?? null,
      processing: pkg?.ref_processing?.value ?? null,
      fsc: pkg?.ref_fsc?.value ?? null,
      quality: pkg?.ref_quality?.value ?? null,
      thickness: pkg?.thickness ?? null,
      width: pkg?.width ?? null,
      length: pkg?.length ?? null,
      availablePieces: pkg?.pieces ?? null,
      totalVolumeM3: pkg?.volume_m3 != null ? Number(pkg.volume_m3) : null,
      piecesUsed: row.pieces_used != null ? Number(row.pieces_used) : null,
      volumeM3: Number(row.volume_m3),
      notes: pkg?.notes ?? null,
      createdAt: row.created_at,
    };
  });

  return { success: true, data: inputs };
}
