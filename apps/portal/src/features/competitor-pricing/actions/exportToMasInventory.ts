"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

const MAS_ORG_ID = "6d11e93b-02eb-41de-a6b1-f026a35c1cfb";

interface ExportResult {
  packagesCreated: number;
  packagesDeleted: number;
  shipmentCode: string;
}

/**
 * Export Mass.ee scraped data to MAS inventory.
 *
 * - Deletes all existing MAS inventory packages (and their dummy shipments)
 * - Creates a new dummy shipment
 * - Inserts all mass.ee competitor_prices as inventory_packages
 * - Uses TIM prices as inventory unit prices (EUR cents)
 */
export async function exportToMasInventory(): Promise<ActionResult<ExportResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;

  // 1. Load ref tables for ID lookups
  const [speciesRes, qualityRes, productNameRes, humidityRes, processingRes, fscRes, typeRes] = await Promise.all([
    supabase.from("ref_wood_species").select("id, value"),
    supabase.from("ref_quality").select("id, value"),
    supabase.from("ref_product_names").select("id, value"),
    supabase.from("ref_humidity").select("id, value"),
    supabase.from("ref_processing").select("id, value"),
    supabase.from("ref_fsc").select("id, value"),
    supabase.from("ref_types").select("id, value"),
  ]);

  // Build lookup maps (case-insensitive)
  const speciesMap: Record<string, string> = {};
  for (const row of (speciesRes.data || []) as { id: string; value: string }[]) {
    speciesMap[row.value.toLowerCase()] = row.id;
  }

  const qualityMap: Record<string, string> = {};
  for (const row of (qualityRes.data || []) as { id: string; value: string }[]) {
    qualityMap[row.value.toLowerCase()] = row.id;
  }

  const typeMap: Record<string, string> = {};
  for (const row of (typeRes.data || []) as { id: string; value: string }[]) {
    typeMap[row.value.toLowerCase()] = row.id;
  }

  // Find specific ref IDs
  const productNameId = ((productNameRes.data || []) as { id: string; value: string }[]).find(
    (r) => r.value.toLowerCase().includes("solid wood panel")
  )?.id || null;

  const humidityId = ((humidityRes.data || []) as { id: string; value: string }[]).find(
    (r) => r.value.toLowerCase().includes("kd 7-9")
  )?.id || null;

  const processingId = ((processingRes.data || []) as { id: string; value: string }[]).find(
    (r) => r.value.toLowerCase() === "sanded"
  )?.id || null;

  const fscId = ((fscRes.data || []) as { id: string; value: string }[]).find(
    (r) => r.value.toLowerCase() === "no"
  )?.id || null;

  // 2. Load mass.ee competitor prices
  const { data: massData, error: massError } = await supabase
    .from("competitor_prices")
    .select("*")
    .eq("source", "mass.ee")
    .order("species")
    .order("panel_type")
    .order("quality")
    .order("thickness_mm")
    .order("width_mm")
    .order("length_mm");

  if (massError) {
    return { success: false, error: `Failed to load Mass.ee data: ${(massError as { message: string }).message}` };
  }

  const items = (massData || []) as {
    species: string | null;
    panel_type: string | null;
    quality: string | null;
    thickness_mm: number;
    width_mm: number;
    length_mm: number;
    stock_total: number;
    ti_price_per_piece: number | null;
    ti_price_per_m3: number | null;
    ti_price_per_m2: number | null;
  }[];

  if (items.length === 0) {
    return { success: false, error: "No Mass.ee scraped data found" };
  }

  // 3. Delete existing MAS inventory packages
  const { data: existingPackages } = await supabase
    .from("inventory_packages")
    .select("id, shipment_id")
    .eq("organisation_id", MAS_ORG_ID);

  const existing = (existingPackages || []) as { id: string; shipment_id: string | null }[];
  const existingCount = existing.length;

  // Collect shipment IDs to clean up dummy shipments
  const shipmentIds = new Set<string>();
  for (const pkg of existing) {
    if (pkg.shipment_id) shipmentIds.add(pkg.shipment_id);
  }

  // Delete packages first (FK constraint: packages reference shipments)
  if (existingCount > 0) {
    const { error: deleteError } = await supabase
      .from("inventory_packages")
      .delete()
      .eq("organisation_id", MAS_ORG_ID);

    if (deleteError) {
      return { success: false, error: `Failed to delete existing packages: ${(deleteError as { message: string }).message}` };
    }
  }

  // Clean up orphaned dummy shipments (only those with MAS-SCRAPE prefix)
  for (const sid of shipmentIds) {
    const { data: shipment } = await supabase
      .from("shipments")
      .select("id, shipment_code")
      .eq("id", sid)
      .single();

    const sc = (shipment as { shipment_code?: string })?.shipment_code;
    if (sc?.startsWith("SCRAPE-") || sc?.startsWith("MAS-SCRAPE")) {
      await supabase.from("shipments").delete().eq("id", sid);
    }
  }

  // 4. Create dummy shipment
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const shipmentCode = `SCRAPE-${dateStr}`;

  // Get next shipment number from sequence
  const { data: seqData } = await supabase.rpc("get_next_shipment_number");
  const shipmentNumber = seqData ?? Math.floor(Date.now() / 1000);

  const { data: newShipment, error: shipmentError } = await supabase
    .from("shipments")
    .insert({
      shipment_code: shipmentCode,
      shipment_number: shipmentNumber,
      from_organisation_id: null,
      to_organisation_id: MAS_ORG_ID,
      status: "completed",
      shipment_date: now.toISOString().slice(0, 10),
      notes: `Auto-imported from Mass.ee scraper data (${items.length} products)`,
    })
    .select("id")
    .single();

  if (shipmentError || !newShipment) {
    return { success: false, error: `Failed to create shipment: ${(shipmentError as { message?: string })?.message || "Unknown error"}` };
  }

  const shipmentId = (newShipment as { id: string }).id;

  // 5. Map scraped data to inventory packages
  const packages = items.map((item, index) => {
    // Species lookup: "ash white" → "Ash" if "ash white" not found
    let woodSpeciesId: string | null = null;
    if (item.species) {
      const speciesLower = item.species.toLowerCase();
      woodSpeciesId = speciesMap[speciesLower] || null;
      if (!woodSpeciesId && speciesLower.startsWith("ash")) {
        woodSpeciesId = speciesMap["ash"] || null;
      }
    }

    // Quality lookup: "Rustic" → "BC" if not found directly
    let qualityId: string | null = null;
    if (item.quality) {
      const qualityLower = item.quality.toLowerCase();
      qualityId = qualityMap[qualityLower] || null;
      if (!qualityId && qualityLower === "rustic") {
        qualityId = qualityMap["bc"] || null;
      }
    }

    // Type: FJ or FS (Full Stave → "full stave")
    let typeId: string | null = null;
    if (item.panel_type) {
      const ptLower = item.panel_type.toLowerCase();
      typeId = typeMap[ptLower] || null;
      if (!typeId && ptLower === "fs") {
        typeId = typeMap["full stave"] || null;
      }
    }

    // Calculate volume
    const volM3 = (item.thickness_mm / 1000) * (item.width_mm / 1000) * (item.length_mm / 1000) * (item.stock_total || 1);
    const volumeM3 = Math.round(volM3 * 1000) / 1000;

    // TIM prices → EUR cents (multiply by 100)
    const unitPricePiece = item.ti_price_per_piece != null ? Math.round(item.ti_price_per_piece * 100) : null;
    const unitPriceM3 = item.ti_price_per_m3 != null ? Math.round(item.ti_price_per_m3 * 100) : null;
    const unitPriceM2 = item.ti_price_per_m2 != null ? Math.round(item.ti_price_per_m2 * 100) : null;

    return {
      shipment_id: shipmentId,
      package_number: `MAS-${String(index + 1).padStart(4, "0")}`,
      package_sequence: index + 1,
      organisation_id: MAS_ORG_ID,
      product_name_id: productNameId,
      wood_species_id: woodSpeciesId,
      humidity_id: humidityId,
      type_id: typeId,
      processing_id: processingId,
      fsc_id: fscId,
      quality_id: qualityId,
      thickness: String(item.thickness_mm),
      width: String(item.width_mm),
      length: String(item.length_mm),
      pieces: String(item.stock_total || 0),
      volume_m3: volumeM3,
      volume_is_calculated: true,
      unit_price_piece: unitPricePiece,
      unit_price_m3: unitPriceM3,
      unit_price_m2: unitPriceM2,
      status: "available",
    };
  });

  // 6. Insert in batches of 100
  let inserted = 0;
  const BATCH_SIZE = 100;
  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const batch = packages.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from("inventory_packages")
      .insert(batch);

    if (insertError) {
      return {
        success: false,
        error: `Failed to insert batch ${Math.floor(i / BATCH_SIZE) + 1}: ${(insertError as { message: string }).message}. ${inserted} packages were inserted before failure.`,
      };
    }
    inserted += batch.length;
  }

  revalidatePath("/inventory");
  revalidatePath("/admin/inventory");
  revalidatePath("/dashboard");

  return {
    success: true,
    data: {
      packagesCreated: inserted,
      packagesDeleted: existingCount,
      shipmentCode,
    },
  };
}
