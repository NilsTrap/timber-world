"use server";

/**
 * E5 · Catalog picker data for the deal editor.
 *
 * Feeds the "Add from catalog" flow on the Deal tab: internal-visible
 * categories → products → variants, plus the resolve+append actions that
 * turn a chosen variant into a priced deal line item (populating the
 * order_line_items catalog links + *_option_id attribute FKs).
 *
 * Gated on the deal actor (orders.view / admin) — the same gate as the rest
 * of the deal editor. Reads run on the RLS user client (catalog is all-read);
 * writes go through the shared orderDeals service.
 */

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getAccessProfile } from "@/lib/access";
import { resolveDealActor } from "./_dealActor";
import { appendLineItem, deleteLineItem, getOrderDeal } from "../services/orderDeals";
import { resolveFieldAccess } from "../services/dealFields";
import { resolveCatalogLine } from "@/features/catalog/dealPricing";
import type { ActionResult } from "../types";
import type { DealSide } from "../services/dealModel";
import type { OrderDealView } from "../services/orderDeals";

/**
 * A line item's price + total are `deal_terms` (E4 field wall). Adding,
 * removing, or catalog-pricing a line therefore requires the caller to be
 * able to EDIT deal_terms (a Salesperson/Purchasing group) or be an admin —
 * mirroring updateDealLineItemAmounts. Without this a producer/warehouse
 * group with orders.view could write prices the wall hides from them.
 */
async function requireLineWriteAccess(
  actor: { isPlatformAdmin: boolean; portalUserId: string | null },
  orgId: string | null,
): Promise<boolean> {
  if (actor.isPlatformAdmin) return true;
  const profile = await getAccessProfile(actor.portalUserId, orgId);
  return resolveFieldAccess(profile).domainEditable("deal_terms");
}

export interface PickerCategory {
  id: string;
  slug: string;
  name: string;
  primaryUnit: string;
}
export interface PickerProduct {
  id: string;
  name: string;
  sku: string | null;
}
export interface PickerVariant {
  id: string;
  sku: string | null;
  thicknessMm: number | null;
  widthMm: number | null;
  lengthMm: number | null;
}

/** Internal-visible, active categories for the picker. */
export async function getPickerCategories(): Promise<ActionResult<PickerCategory[]>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (await createClient()) as any;
  const { data, error } = await c
    .from("catalog_categories")
    .select("id, slug, name, primary_unit")
    .eq("is_active", true)
    .eq("visible_internal", true)
    .order("sort_order", { ascending: true });
  if (error) return { success: false, error: "Failed to load categories", code: "FETCH_FAILED" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    success: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: (data ?? []).map((r: any) => ({ id: r.id, slug: r.slug, name: r.name, primaryUnit: r.primary_unit })),
  };
}

export async function getPickerProducts(categoryId: string): Promise<ActionResult<PickerProduct[]>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (await createClient()) as any;
  const { data, error } = await c
    .from("catalog_products")
    .select("id, name, sku")
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .eq("visible_internal", true)
    .order("sort_order", { ascending: true });
  if (error) return { success: false, error: "Failed to load products", code: "FETCH_FAILED" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { success: true, data: (data ?? []).map((r: any) => ({ id: r.id, name: r.name, sku: r.sku ?? null })) };
}

export async function getPickerVariants(productId: string): Promise<ActionResult<PickerVariant[]>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (await createClient()) as any;
  const { data, error } = await c
    .from("catalog_variants")
    .select("id, sku, thickness_mm, width_mm, length_mm")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return { success: false, error: "Failed to load variants", code: "FETCH_FAILED" };
  return {
    success: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: (data ?? []).map((r: any) => ({
      id: r.id,
      sku: r.sku ?? null,
      thicknessMm: r.thickness_mm ?? null,
      widthMm: r.width_mm ?? null,
      lengthMm: r.length_mm ?? null,
    })),
  };
}

/**
 * Append a STANDARD line: resolve the catalog variant → auto-price → insert.
 * `quantity` is in the variant's unit (pieces for per_piece; m³ for volume;
 * m² for area; m for length). Populates catalog links + option ids.
 */
export async function addCatalogLineItem(input: {
  orderId: string;
  side: DealSide;
  variantId: string;
  quantity: number;
}): Promise<ActionResult<OrderDealView>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await requireLineWriteAccess(a.actor, a.orgId))) {
    return { success: false, error: "You cannot price deal lines", code: "FORBIDDEN" };
  }
  if (!(input.quantity > 0)) {
    return { success: false, error: "Quantity must be greater than zero", code: "VALIDATION_ERROR" };
  }

  // Deal currency drives which catalog price we resolve.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = a.db as any;
  const { data: order } = await c.from("orders").select("currency").eq("id", input.orderId).maybeSingle();
  const currency = (order?.currency as string) ?? "EUR";

  const resolved = await resolveCatalogLine(a.db, input.variantId, currency);
  if (!resolved) return { success: false, error: "Catalog variant not found", code: "NOT_FOUND" };

  // The quantity is ALREADY in the resolved unit (pieces, m³, m², m). Piece and
  // m³ have a dedicated quantity column; area/length units carry no quantity
  // column, so we store the line total explicitly. The total is always
  // rate × quantity (the rate is per-unit-of the resolved unit).
  const pieces = resolved.unit === "piece" ? String(input.quantity) : null;
  const volumeM3 = resolved.unit === "m3" ? input.quantity : null;
  const lineTotalCents =
    resolved.unitPriceCents != null && input.quantity > 0
      ? Math.round(resolved.unitPriceCents * input.quantity)
      : null;

  const res = await appendLineItem(a.db, a.actor, input.orderId, input.side, {
    productName: resolved.productName,
    woodSpecies: resolved.woodSpecies,
    humidity: resolved.humidity,
    processing: resolved.processing,
    quality: resolved.quality,
    productType: resolved.productType,
    woodSpeciesOptionId: resolved.woodSpeciesOptionId,
    humidityOptionId: resolved.humidityOptionId,
    processingOptionId: resolved.processingOptionId,
    qualityOptionId: resolved.qualityOptionId,
    productTypeOptionId: resolved.productTypeOptionId,
    thickness: resolved.thickness,
    width: resolved.width,
    length: resolved.length,
    pieces,
    volumeM3,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    unit: resolved.unit as any,
    unitPriceCents: resolved.unitPriceCents,
    // Explicit total covers area/length units (no quantity column); for
    // piece/m³ appendLineItem re-derives the identical value from the column.
    lineTotalCents,
    catalogProductId: resolved.catalogProductId,
    catalogVariantId: resolved.catalogVariantId,
    isStandard: true,
  });
  if (!res.success) return res as unknown as ActionResult<OrderDealView>;
  return getOrderDeal(a.db, a.actor, input.orderId);
}

/**
 * Append a NON-STANDARD (custom) line: free-text attributes + per-deal price.
 * No catalog link; is_standard=false.
 */
export async function addCustomLineItem(input: {
  orderId: string;
  side: DealSide;
  productName?: string | null;
  woodSpecies?: string | null;
  thickness?: string | null;
  width?: string | null;
  length?: string | null;
  pieces?: string | null;
  volumeM3?: number | null;
  unit?: string;
  unitPriceCents?: number | null;
  notes?: string | null;
}): Promise<ActionResult<OrderDealView>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await requireLineWriteAccess(a.actor, a.orgId))) {
    return { success: false, error: "You cannot price deal lines", code: "FORBIDDEN" };
  }
  const res = await appendLineItem(a.db, a.actor, input.orderId, input.side, {
    productName: input.productName ?? null,
    woodSpecies: input.woodSpecies ?? null,
    thickness: input.thickness ?? null,
    width: input.width ?? null,
    length: input.length ?? null,
    pieces: input.pieces ?? null,
    volumeM3: input.volumeM3 ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    unit: (input.unit ?? "m3") as any,
    unitPriceCents: input.unitPriceCents ?? null,
    notes: input.notes ?? null,
    isStandard: false,
  });
  if (!res.success) return res as unknown as ActionResult<OrderDealView>;
  return getOrderDeal(a.db, a.actor, input.orderId);
}

/** Remove a line item from a deal. */
export async function removeLineItem(input: {
  orderId: string;
  lineItemId: string;
}): Promise<ActionResult<OrderDealView>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await requireLineWriteAccess(a.actor, a.orgId))) {
    return { success: false, error: "You cannot modify deal lines", code: "FORBIDDEN" };
  }
  const res = await deleteLineItem(a.db, a.actor, input.orderId, input.lineItemId);
  if (!res.success) return res as unknown as ActionResult<OrderDealView>;
  return getOrderDeal(a.db, a.actor, input.orderId);
}

/** Preview the auto-price for a variant in the deal currency (for the picker). */
export async function previewCatalogLinePrice(input: {
  orderId: string;
  variantId: string;
  quantity: number;
}): Promise<ActionResult<{ unitPriceCents: number | null; unit: string; lineTotalCents: number | null }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = a.db as any;
  const { data: order } = await c.from("orders").select("currency").eq("id", input.orderId).maybeSingle();
  const currency = (order?.currency as string) ?? "EUR";
  const resolved = await resolveCatalogLine(a.db, input.variantId, currency);
  if (!resolved) return { success: false, error: "Catalog variant not found", code: "NOT_FOUND" };
  // Quantity is already in the resolved unit (the field is labelled with that
  // unit), so the total is rate × quantity for every unit — matching exactly
  // what addCatalogLineItem persists.
  const lineTotalCents =
    resolved.unitPriceCents != null && input.quantity > 0
      ? Math.round(resolved.unitPriceCents * input.quantity)
      : null;
  return {
    success: true,
    data: { unitPriceCents: resolved.unitPriceCents, unit: resolved.unit, lineTotalCents },
  };
}
