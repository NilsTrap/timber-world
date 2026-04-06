"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

interface OrderProductInput {
  dbId: string | null;
  staircaseCodeId: string;
  productNameId: string;
  woodSpeciesId: string;
  typeId: string;
  qualityId: string;
  thickness: string;
  width: string;
  riser: string;
  length: string;
  pieces: string;
  volumeM3: number;
  unitPrice: number;
  workPerPiece: number;
  transportPerPiece: number;
  eurPerM3: number;
}

interface SaveResult {
  insertedIds: Record<number, string>;
}

/**
 * Batch save order products (insert/update/delete diff).
 */
export async function saveOrderProducts(
  orderId: string,
  organisationId: string,
  rows: OrderProductInput[]
): Promise<ActionResult<SaveResult>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    const userOrgId = session.currentOrganizationId || session.organisationId;
    const canCreate = await orgHasModule(userOrgId, "orders.create");
    if (!canCreate) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
  }

  if (!isValidUUID(orderId)) {
    return { success: false, error: "Invalid order ID", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Fetch existing packages for this order
  const { data: existingRows, error: fetchError } = await client
    .from("inventory_packages")
    .select("id, staircase_code_id, product_name_id, wood_species_id, type_id, quality_id, thickness, width, riser, length, pieces, volume_m3, unit_price_piece, work_per_piece, transport_per_piece, eur_per_m3")
    .eq("order_id", orderId)
    .eq("status", "ordered");

  if (fetchError) {
    return { success: false, error: `Failed to fetch existing products: ${fetchError.message}`, code: "FETCH_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingMap = new Map<string, any>((existingRows || []).map((r: any) => [r.id, r]));
  const clientDbIds = new Set<string>(rows.filter((r) => r.dbId).map((r) => r.dbId!));

  // DELETE: DB rows not in client list
  const toDelete = [...existingMap.keys()].filter((id) => !clientDbIds.has(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await client
      .from("inventory_packages")
      .delete()
      .in("id", toDelete);

    if (deleteError) {
      return { success: false, error: `Failed to delete products: ${deleteError.message}`, code: "DELETE_FAILED" };
    }
  }

  const insertedIds: Record<number, string> = {};

  function toDbPayload(row: OrderProductInput) {
    return {
      order_id: orderId,
      organisation_id: organisationId,
      package_number: null,
      status: "ordered",
      staircase_code_id: row.staircaseCodeId || null,
      product_name_id: row.productNameId || null,
      wood_species_id: row.woodSpeciesId || null,
      type_id: row.typeId || null,
      quality_id: row.qualityId || null,
      thickness: row.thickness || null,
      width: row.width || null,
      riser: row.riser || null,
      length: row.length || null,
      pieces: row.pieces || null,
      volume_m3: row.volumeM3 || null,
      unit_price_piece: row.unitPrice || null,
      work_per_piece: row.workPerPiece || null,
      transport_per_piece: row.transportPerPiece || null,
      eur_per_m3: row.eurPerM3 || null,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function hasChanged(row: OrderProductInput, existing: any): boolean {
    if ((row.staircaseCodeId || null) !== existing.staircase_code_id) return true;
    if ((row.productNameId || null) !== existing.product_name_id) return true;
    if ((row.woodSpeciesId || null) !== existing.wood_species_id) return true;
    if ((row.typeId || null) !== existing.type_id) return true;
    if ((row.qualityId || null) !== existing.quality_id) return true;
    if ((row.thickness || null) !== existing.thickness) return true;
    if ((row.width || null) !== existing.width) return true;
    if ((row.riser || null) !== existing.riser) return true;
    if ((row.length || null) !== existing.length) return true;
    if ((row.pieces || null) !== existing.pieces) return true;
    if (row.volumeM3 !== (parseFloat(existing.volume_m3) || 0)) return true;
    if (row.unitPrice !== (parseFloat(existing.unit_price_piece) || 0)) return true;
    if (row.workPerPiece !== (parseFloat(existing.work_per_piece) || 0)) return true;
    if (row.transportPerPiece !== (parseFloat(existing.transport_per_piece) || 0)) return true;
    if (row.eurPerM3 !== (parseFloat(existing.eur_per_m3) || 0)) return true;
    return false;
  }

  // Separate into inserts and updates
  const toInsert: { index: number; payload: ReturnType<typeof toDbPayload> }[] = [];
  const toUpdate: { id: string; payload: ReturnType<typeof toDbPayload> }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row.dbId) {
      toInsert.push({ index: i, payload: toDbPayload(row) });
    } else {
      const existing = existingMap.get(row.dbId);
      if (existing && hasChanged(row, existing)) {
        toUpdate.push({ id: row.dbId, payload: toDbPayload(row) });
      }
    }
  }

  // Batch INSERT
  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await client
      .from("inventory_packages")
      .insert(toInsert.map((t) => t.payload))
      .select("id");

    if (insertError) {
      return { success: false, error: `Failed to insert products: ${insertError.message}`, code: "INSERT_FAILED" };
    }

    if (inserted) {
      for (let i = 0; i < inserted.length; i++) {
        insertedIds[toInsert[i]!.index] = inserted[i].id;
      }
    }
  }

  // UPDATE changed rows in parallel
  if (toUpdate.length > 0) {
    const updateResults = await Promise.all(
      toUpdate.map(({ id, payload }) => {
        const { package_number: _, ...updatePayload } = payload;
        return client
          .from("inventory_packages")
          .update(updatePayload)
          .eq("id", id);
      })
    );

    for (let i = 0; i < updateResults.length; i++) {
      if (updateResults[i].error) {
        return { success: false, error: `Failed to update product: ${updateResults[i].error.message}`, code: "UPDATE_FAILED" };
      }
    }
  }

  return { success: true, data: { insertedIds } };
}
