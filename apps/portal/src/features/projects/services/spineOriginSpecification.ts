import type { DbClient } from "../../orders/services/dealModel";

export type SpineOriginAllocation = {
  originLineItemId: string;
  lineNo: number;
  productName: string;
  unit: string;
  requiredQuantity: number;
  requestedQuantity: number;
  awardedQuantity: number;
  remainingQuantity: number;
};
export type SpineOriginAllocationResult = { ok: true; data: SpineOriginAllocation[] } | { ok: false; error: "unavailable" };

export function parseSpineOriginAllocation(data: unknown): SpineOriginAllocationResult {
  if (!Array.isArray(data)) return { ok: false, error: "unavailable" };
  const rows = (data as Array<Record<string, unknown>>).map((row) => ({
    originLineItemId: String(row.originLineItemId ?? row.origin_line_item_id), lineNo: Number(row.lineNo ?? row.line_no),
    productName: String(row.productName ?? row.product_name ?? "Specification line"), unit: String(row.unit ?? "pcs"),
    requiredQuantity: Number(row.requiredQuantity ?? row.required_quantity), requestedQuantity: Number(row.requestedQuantity ?? row.requested_quantity),
    awardedQuantity: Number(row.awardedQuantity ?? row.awarded_quantity), remainingQuantity: Number(row.remainingQuantity ?? row.remaining_quantity),
  }));
  if (rows.some((row) => !row.originLineItemId || !Number.isFinite(row.requiredQuantity) || row.requiredQuantity <= 0 || !Number.isFinite(row.remainingQuantity))) return { ok: false, error: "unavailable" };
  return { ok: true, data: rows };
}

/** The database function resolves the one allowlisted root from the source
 * deal's spine.  A downstream deal is navigation context, never the baseline. */
export async function loadSpineOriginAllocation(db: DbClient, sourceProjectId: string): Promise<SpineOriginAllocationResult> {
  const { data, error } = await db.rpc("get_spine_origin_allocation", { p_source_order_id: sourceProjectId });
  return error ? { ok: false, error: "unavailable" } : parseSpineOriginAllocation(data);
}
