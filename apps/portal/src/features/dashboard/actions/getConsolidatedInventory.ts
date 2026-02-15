"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, isSuperAdmin } from "@/lib/auth";
import type { ActionResult, ConsolidatedInventoryItem } from "../types";

/**
 * Get Consolidated Inventory
 *
 * Groups inventory packages by 6 attributes:
 * - Product Name
 * - Wood Species
 * - Humidity
 * - Type
 * - Processing
 * - Quality
 *
 * Returns totals (package count, pieces, volume) for each unique combination.
 *
 * @param orgIds - Optional org IDs for Super Admin to filter by specific organisations
 */
export async function getConsolidatedInventory(
  orgIds?: string[]
): Promise<ActionResult<ConsolidatedInventoryItem[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // Fetch all non-consumed packages with their reference values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packagesData, error: packagesError } = await (supabase as any)
    .from("inventory_packages")
    .select(`
      id,
      organisation_id,
      pieces,
      volume_m3,
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    `)
    .neq("status", "consumed");

  if (packagesError) {
    console.error("[getConsolidatedInventory] Failed to fetch packages:", packagesError.message);
    return { success: false, error: packagesError.message, code: "QUERY_FAILED" };
  }

  // Apply org filter if specified (Super Admin multi-select)
  const orgIdSet = isSuperAdmin(session) && orgIds && orgIds.length > 0
    ? new Set(orgIds)
    : null;

  // Group packages by the 6 attributes
  const groupMap = new Map<string, ConsolidatedInventoryItem>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const pkg of (packagesData as any[]) || []) {
    // Apply org filter
    if (orgIdSet && (!pkg.organisation_id || !orgIdSet.has(pkg.organisation_id))) {
      continue;
    }

    const productName = pkg.ref_product_names?.value ?? null;
    const woodSpecies = pkg.ref_wood_species?.value ?? null;
    const humidity = pkg.ref_humidity?.value ?? null;
    const typeName = pkg.ref_types?.value ?? null;
    const processing = pkg.ref_processing?.value ?? null;
    const quality = pkg.ref_quality?.value ?? null;

    // Create a unique key for grouping
    const key = [
      productName ?? "",
      woodSpecies ?? "",
      humidity ?? "",
      typeName ?? "",
      processing ?? "",
      quality ?? "",
    ].join("|");

    const existing = groupMap.get(key);
    const pieces = pkg.pieces ? parseInt(pkg.pieces, 10) : 0;
    const volumeM3 = Number(pkg.volume_m3) || 0;

    if (existing) {
      existing.packageCount++;
      existing.totalPieces += isNaN(pieces) ? 0 : pieces;
      existing.totalVolumeM3 += volumeM3;
    } else {
      groupMap.set(key, {
        productName,
        woodSpecies,
        humidity,
        typeName,
        processing,
        quality,
        packageCount: 1,
        totalPieces: isNaN(pieces) ? 0 : pieces,
        totalVolumeM3: volumeM3,
      });
    }
  }

  // Convert map to array and sort by Product → Species → Humidity → Type → Processing → Quality
  const result = Array.from(groupMap.values()).sort((a, b) => {
    // Compare each field in order, using empty string for nulls to sort them last
    const fields: (keyof ConsolidatedInventoryItem)[] = [
      "productName",
      "woodSpecies",
      "humidity",
      "typeName",
      "processing",
      "quality",
    ];
    for (const field of fields) {
      const aVal = (a[field] as string | null) ?? "";
      const bVal = (b[field] as string | null) ?? "";
      const cmp = aVal.localeCompare(bVal);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });

  return { success: true, data: result };
}
