/**
 * Catalog stock service — `(db, …)`-style shared layer over `catalog_variant_stock`
 * for the MCP route (admin client) and any non-session caller. The session-bound
 * `actions/stock.ts` thinly delegates here (one implementation, no logic
 * duplication) and keeps its own session gate + `revalidatePath`. Mirrors the
 * pattern of `catalog/services/attributes.ts` (functions take `db`; permission is
 * the caller's job — the MCP gates on the full-access token).
 */
import type { ActionResult } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

/** One stock line for a variant — a quantity held in a given packaging form. */
export interface VariantStockEntry {
  id: string;
  variantId: string;
  packagingTypeId: string | null; // null = loose pieces
  packagingName: string | null;
  piecesPerPackage: number | null; // null for loose
  quantity: number; // number of packages (or loose pieces)
  pieces: number; // computed total pieces this line represents
}

export interface VariantStockSummary {
  entries: VariantStockEntry[];
  totalPieces: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEntry(row: any): VariantStockEntry {
  const ppp = row.catalog_packaging_types?.pieces_per_package ?? null;
  const qty = Number(row.quantity) || 0;
  const pieces = ppp != null ? qty * Number(ppp) : qty; // loose → quantity is already pieces
  return {
    id: row.id,
    variantId: row.variant_id,
    packagingTypeId: row.packaging_type_id,
    packagingName: row.catalog_packaging_types?.name ?? null,
    piecesPerPackage: ppp != null ? Number(ppp) : null,
    quantity: qty,
    pieces,
  };
}

/** Read a variant's stock lines + total pieces. */
export async function getVariantStock(db: DbClient, variantId: string): Promise<ActionResult<VariantStockSummary>> {
  const { data, error } = await db
    .from("catalog_variant_stock")
    .select("id, variant_id, packaging_type_id, quantity, catalog_packaging_types(name, pieces_per_package)")
    .eq("variant_id", variantId);
  if (error) return { success: false, error: error.message };

  const entries = (data ?? []).map(rowToEntry).sort((a: VariantStockEntry, b: VariantStockEntry) => {
    // loose last, otherwise by packaging name
    if (a.packagingTypeId == null) return 1;
    if (b.packagingTypeId == null) return -1;
    return (a.packagingName ?? "").localeCompare(b.packagingName ?? "");
  });
  const totalPieces = entries.reduce((s: number, e: VariantStockEntry) => s + e.pieces, 0);
  return { success: true, data: { entries, totalPieces } };
}

/**
 * Create or update a variant's stock quantity for a packaging form.
 * ENFORCES the packaging-form guard: stock can only be held in a form that is
 * assigned to the variant (its packaging assignments) — the identical server
 * check the UI relies on. Quantity must be ≥ 0 and a packaging form is required.
 */
export async function saveVariantStockEntry(
  db: DbClient,
  input: { variantId: string; packagingTypeId: string | null; quantity: number },
): Promise<ActionResult<null>> {
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    return { success: false, error: "Quantity must be zero or more." };
  }
  if (!input.packagingTypeId) {
    return { success: false, error: "Pick a packaging form defined for this variant." };
  }

  // Guard: stock can only be held in a packaging form DEFINED for this variant
  // (its packaging assignments) — no stocking in undefined forms.
  const { data: assigned } = await db
    .from("catalog_variant_packaging_assignments")
    .select("id")
    .eq("variant_id", input.variantId)
    .eq("packaging_type_id", input.packagingTypeId)
    .maybeSingle();
  if (!assigned) {
    return { success: false, error: "That packaging form isn't defined for this variant. Add it in the Packaging card first." };
  }

  // Find an existing line for this (variant, packaging form) — null-safe.
  let q = db.from("catalog_variant_stock").select("id").eq("variant_id", input.variantId);
  q = input.packagingTypeId == null ? q.is("packaging_type_id", null) : q.eq("packaging_type_id", input.packagingTypeId);
  const { data: existing } = await q.maybeSingle();

  if (existing?.id) {
    const { error } = await db
      .from("catalog_variant_stock")
      .update({ quantity: input.quantity, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await db
      .from("catalog_variant_stock")
      .insert({ variant_id: input.variantId, packaging_type_id: input.packagingTypeId, quantity: input.quantity });
    if (error) return { success: false, error: error.message };
  }
  return { success: true, data: null };
}

/** Delete a variant stock line by id. */
export async function deleteVariantStockEntry(db: DbClient, id: string): Promise<ActionResult<null>> {
  const { error } = await db.from("catalog_variant_stock").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
