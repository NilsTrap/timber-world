"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

interface AddOrderPackageInput {
  orderId: string;
  packageNumber: string;
  organisationId: string;
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
  unitPricePiece?: number | null;
  unitPriceM3?: number | null;
  unitPriceM2?: number | null;
  notes?: string | null;
}

/**
 * Add a new package to an order.
 * Creates an inventory_packages record with status "ordered" and linked to the order.
 */
export async function addOrderPackage(
  input: AddOrderPackageInput
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!isValidUUID(input.orderId)) {
    return { success: false, error: "Invalid order ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { data, error } = await client
    .from("inventory_packages")
    .insert({
      order_id: input.orderId,
      package_number: input.packageNumber,
      organisation_id: input.organisationId,
      status: "ordered",
      product_name_id: input.productNameId ?? null,
      wood_species_id: input.woodSpeciesId ?? null,
      humidity_id: input.humidityId ?? null,
      type_id: input.typeId ?? null,
      processing_id: input.processingId ?? null,
      fsc_id: input.fscId ?? null,
      quality_id: input.qualityId ?? null,
      thickness: input.thickness ?? null,
      width: input.width ?? null,
      length: input.length ?? null,
      pieces: input.pieces ?? null,
      volume_m3: input.volumeM3 ?? null,
      unit_price_piece: input.unitPricePiece ?? null,
      unit_price_m3: input.unitPriceM3 ?? null,
      unit_price_m2: input.unitPriceM2 ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[addOrderPackage] Failed:", error);
    return { success: false, error: "Failed to add package", code: "INSERT_FAILED" };
  }

  return { success: true, data: { id: data.id } };
}
