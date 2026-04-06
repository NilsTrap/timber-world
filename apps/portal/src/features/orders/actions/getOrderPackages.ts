"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

export interface OrderPackage {
  id: string;
  packageNumber: string;
  productName: string | null;
  woodSpecies: string | null;
  humidity: string | null;
  typeName: string | null;
  processing: string | null;
  fsc: string | null;
  quality: string | null;
  thickness: string | null;
  width: string | null;
  riser: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
  status: string;
  staircaseCodeId: string | null;
  unitPricePiece: number | null;
  unitPriceM3: number | null;
  unitPriceM2: number | null;
  workPerPiece: number | null;
  transportPerPiece: number | null;
  eurPerM3: number | null;
  notes: string | null;
  productionEntryId: string | null;
}

/**
 * Get all inventory packages linked to an order.
 * Returns both "ordered" (spec) packages and "produced" (actual) packages.
 */
export async function getOrderPackages(
  orderId: string
): Promise<ActionResult<OrderPackage[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isValidUUID(orderId)) {
    return { success: false, error: "Invalid order ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data, error } = await client
    .from("inventory_packages")
    .select(`
      id, package_number, status, thickness, width, riser, length, pieces,
      volume_m3, notes, production_entry_id, staircase_code_id,
      unit_price_piece, unit_price_m3, unit_price_m2,
      work_per_piece, transport_per_piece, eur_per_m3,
      ref_product_names (value),
      ref_wood_species (value),
      ref_humidity (value),
      ref_types (value),
      ref_processing (value),
      ref_fsc (value),
      ref_quality (value)
    `)
    .eq("order_id", orderId)
    .order("package_number", { ascending: true });

  if (error) {
    console.error("[getOrderPackages] Failed:", error);
    return { success: false, error: "Failed to fetch order packages", code: "FETCH_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packages: OrderPackage[] = (data || []).map((row: any) => ({
    id: row.id,
    packageNumber: row.package_number,
    productName: row.ref_product_names?.value ?? null,
    woodSpecies: row.ref_wood_species?.value ?? null,
    humidity: row.ref_humidity?.value ?? null,
    typeName: row.ref_types?.value ?? null,
    processing: row.ref_processing?.value ?? null,
    fsc: row.ref_fsc?.value ?? null,
    quality: row.ref_quality?.value ?? null,
    thickness: row.thickness,
    width: row.width,
    riser: row.riser,
    length: row.length,
    pieces: row.pieces,
    volumeM3: row.volume_m3,
    staircaseCodeId: row.staircase_code_id ?? null,
    status: row.status,
    unitPricePiece: row.unit_price_piece,
    unitPriceM3: row.unit_price_m3,
    unitPriceM2: row.unit_price_m2,
    workPerPiece: row.work_per_piece != null ? parseFloat(row.work_per_piece) : null,
    transportPerPiece: row.transport_per_piece != null ? parseFloat(row.transport_per_piece) : null,
    eurPerM3: row.eur_per_m3 != null ? parseFloat(row.eur_per_m3) : null,
    notes: row.notes,
    productionEntryId: row.production_entry_id,
  }));

  return { success: true, data: packages };
}
