"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeQuantity, commissionPctForDiscount, clampDiscount, type CalcMethod, type CommissionConfig } from "@/lib/pricing";
import type { CartItem, CartOrder, VariantOrderContext } from "@/lib/orderTypes";

type Result<T> = { success: true; data: T } | { success: false; error: string };

function toItem(r: any): CartItem {
  return {
    id: r.id, variantId: r.variant_id, productName: r.product_name, variantLabel: r.variant_label,
    sku: r.sku, packagingName: r.packaging_name, piecesPerPackage: r.pieces_per_package,
    baseQtyPerPackage: r.base_qty_per_package != null ? Number(r.base_qty_per_package) : null,
    unitSymbol: r.unit_symbol, unitPriceCents: r.unit_price_cents, quantityPackages: r.quantity_packages,
    discountPct: Number(r.discount_pct), lineSubtotalCents: r.line_subtotal_cents, lineTotalCents: r.line_total_cents,
    commissionPct: Number(r.commission_pct), commissionCents: r.commission_cents,
  };
}

function toOrder(r: any): CartOrder {
  return {
    id: r.id, code: r.code, status: r.status, customerName: r.customer_name, customerCompany: r.customer_company,
    deliveryAddress: r.delivery_address, notes: r.notes, subtotalCents: r.subtotal_cents,
    discountTotalCents: r.discount_total_cents, totalCents: r.total_cents, commissionTotalCents: r.commission_total_cents,
    submittedAt: r.submitted_at, createdAt: r.created_at,
    items: (r.agent_order_items || []).map(toItem),
  };
}

async function getAgentId(supabase: any): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("agent_users").select("id, application_status, is_active").eq("auth_user_id", user.id).maybeSingle();
  if (!data || data.application_status !== "approved" || !data.is_active) return null;
  return data.id;
}

async function getOrCreateCartId(supabase: any, agentId: string): Promise<string> {
  const { data: existing } = await supabase.from("agent_orders").select("id").eq("agent_user_id", agentId).eq("status", "cart").maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.from("agent_orders").insert({ agent_user_id: agentId, status: "cart" }).select("id").single();
  if (error) {
    // race: another request created it — fetch again
    const { data: again } = await supabase.from("agent_orders").select("id").eq("agent_user_id", agentId).eq("status", "cart").single();
    return again.id;
  }
  return data.id;
}

async function recomputeTotals(supabase: any, orderId: string) {
  const { data: items } = await supabase.from("agent_order_items").select("line_subtotal_cents, line_total_cents, commission_cents").eq("order_id", orderId);
  let subtotal = 0, total = 0, commission = 0;
  for (const it of items || []) { subtotal += it.line_subtotal_cents; total += it.line_total_cents; commission += it.commission_cents; }
  await supabase.from("agent_orders").update({
    subtotal_cents: subtotal, discount_total_cents: subtotal - total, total_cents: total, commission_total_cents: commission,
  }).eq("id", orderId);
}

interface PricingCtx {
  productId: string; categoryId: string;
  productName: string; variantLabel: string; sku: string | null;
  packagingName: string; piecesPerPackage: number; baseQtyPerPackage: number; perPieceQty: number;
  unitSymbol: string; gbpRateCents: number; commission: CommissionConfig;
  stockQuantity: number | null; stockUnit: string;
}

async function loadPricing(supabase: any, variantId: string): Promise<Result<PricingCtx>> {
  const { data: v } = await supabase.from("catalog_variants")
    .select("id, sku, thickness_mm, width_mm, length_mm, product_id, stock_quantity, stock_unit").eq("id", variantId).single();
  if (!v) return { success: false, error: "Variant not found" };

  const { data: p } = await supabase.from("catalog_products").select("id, name, category_id").eq("id", v.product_id).single();
  if (!p) return { success: false, error: "Product not found" };

  const { data: c } = await supabase.from("catalog_categories")
    .select("id, primary_unit, commission_standard_pct, commission_max_discount_pct, commission_discounted_pct").eq("id", p.category_id).single();
  if (!c) return { success: false, error: "Category not found" };

  const { data: unit } = await supabase.from("catalog_pricing_units").select("symbol, calc_method").eq("code", c.primary_unit).single();
  const calcMethod: CalcMethod = unit?.calc_method ?? "per_piece";

  const { data: pkg } = await supabase.from("catalog_variant_packaging_assignments")
    .select("is_default, catalog_packaging_types(name, pieces_per_package)").eq("variant_id", variantId).order("is_default", { ascending: false });
  const def = (pkg || []).find((x: any) => x.is_default) ?? (pkg || [])[0];
  if (!def?.catalog_packaging_types) return { success: false, error: "This variant has no packaging set — it can't be ordered yet." };
  const piecesPerPackage = def.catalog_packaging_types.pieces_per_package;
  const packagingName = def.catalog_packaging_types.name;

  // GBP rate: variant -> product -> category
  const { data: prices } = await supabase.from("catalog_currency_prices")
    .select("entity_type, entity_id, price_cents").eq("currency_code", "GBP")
    .in("entity_id", [variantId, p.id, c.id]);
  const map: Record<string, number> = {};
  for (const r of prices || []) map[`${r.entity_type}:${r.entity_id}`] = r.price_cents;
  const gbpRateCents = map[`variant:${variantId}`] ?? map[`product:${p.id}`] ?? map[`category:${c.id}`] ?? null;
  if (gbpRateCents == null) return { success: false, error: "No GBP price set for this item yet." };

  const perPieceQty = computeQuantity(calcMethod, v);
  if (perPieceQty == null) return { success: false, error: "Variant is missing dimensions needed for pricing." };
  const baseQtyPerPackage = piecesPerPackage * perPieceQty;

  return {
    success: true,
    data: {
      productId: p.id, categoryId: c.id,
      productName: p.name,
      variantLabel: [v.thickness_mm, v.width_mm, v.length_mm].filter((x: any) => x != null).join(" × ") + " mm",
      sku: v.sku ?? null,
      packagingName, piecesPerPackage, baseQtyPerPackage, perPieceQty,
      unitSymbol: unit?.symbol ?? "unit", gbpRateCents,
      commission: { standardPct: c.commission_standard_pct, maxDiscountPct: c.commission_max_discount_pct, discountedPct: c.commission_discounted_pct },
      stockQuantity: v.stock_quantity != null ? Number(v.stock_quantity) : null,
      stockUnit: v.stock_unit ?? "piece",
    },
  };
}

export async function getVariantOrderContext(variantId: string): Promise<Result<VariantOrderContext>> {
  const supabase = await createClient();
  const agentId = await getAgentId(supabase);
  if (!agentId) return { success: false, error: "Not an approved agent" };

  const ctx = await loadPricing(supabase, variantId);
  if (!ctx.success) return ctx;
  const c = ctx.data;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: agent } = await supabase.from("agent_users").select("show_commissions").eq("auth_user_id", user!.id).maybeSingle();

  // stock -> packages available + base-unit total
  let stockPackages: number | null = null;
  let stockBaseQty: number | null = null;
  if (c.stockQuantity != null) {
    const pieces = c.stockUnit === "package" ? c.stockQuantity * c.piecesPerPackage : c.stockQuantity;
    stockPackages = c.piecesPerPackage > 0 ? Math.round((pieces / c.piecesPerPackage) * 100) / 100 : null;
    stockBaseQty = Math.round(pieces * c.perPieceQty * 100) / 100;
  }

  return {
    success: true,
    data: {
      productId: c.productId, categoryId: c.categoryId, productName: c.productName, variantLabel: c.variantLabel, sku: c.sku,
      packagingName: c.packagingName, piecesPerPackage: c.piecesPerPackage, baseQtyPerPackage: c.baseQtyPerPackage, unitSymbol: c.unitSymbol,
      gbpRateCents: c.gbpRateCents, packagePriceCents: Math.round(c.gbpRateCents * c.baseQtyPerPackage),
      commission: c.commission, showCommissions: !!agent?.show_commissions,
      stockPackages, stockBaseQty,
    },
  };
}

/** Display-only context for the public (signed-out) catalog — price/stock/packaging, no ordering. */
export async function getVariantPublicContext(variantId: string): Promise<Result<VariantOrderContext>> {
  const supabase = await createClient();
  const ctx = await loadPricing(supabase, variantId);
  if (!ctx.success) return ctx;
  const c = ctx.data;

  let stockPackages: number | null = null;
  let stockBaseQty: number | null = null;
  if (c.stockQuantity != null) {
    const pieces = c.stockUnit === "package" ? c.stockQuantity * c.piecesPerPackage : c.stockQuantity;
    stockPackages = c.piecesPerPackage > 0 ? Math.round((pieces / c.piecesPerPackage) * 100) / 100 : null;
    stockBaseQty = Math.round(pieces * c.perPieceQty * 100) / 100;
  }

  return {
    success: true,
    data: {
      productId: c.productId, categoryId: c.categoryId, productName: c.productName, variantLabel: c.variantLabel, sku: c.sku,
      packagingName: c.packagingName, piecesPerPackage: c.piecesPerPackage, baseQtyPerPackage: c.baseQtyPerPackage, unitSymbol: c.unitSymbol,
      gbpRateCents: c.gbpRateCents, packagePriceCents: Math.round(c.gbpRateCents * c.baseQtyPerPackage),
      commission: c.commission, showCommissions: false,
      stockPackages, stockBaseQty,
    },
  };
}

function lineAmounts(ctx: PricingCtx, quantityPackages: number, discountPct: number) {
  const packagePriceCents = Math.round(ctx.gbpRateCents * ctx.baseQtyPerPackage);
  const lineSubtotal = packagePriceCents * quantityPackages;
  const d = clampDiscount(ctx.commission, discountPct);
  const lineTotal = Math.round(lineSubtotal * (1 - d / 100));
  const commissionPct = commissionPctForDiscount(ctx.commission, d);
  const commissionCents = Math.round((lineTotal * commissionPct) / 100);
  return { packagePriceCents, lineSubtotal, lineTotal, d, commissionPct, commissionCents };
}

export async function getCart(): Promise<Result<CartOrder | null>> {
  const supabase = await createClient();
  const agentId = await getAgentId(supabase);
  if (!agentId) return { success: false, error: "Not an approved agent" };
  const { data } = await supabase.from("agent_orders")
    .select("*, agent_order_items(*)").eq("agent_user_id", agentId).eq("status", "cart").maybeSingle();
  return { success: true, data: data ? toOrder(data) : null };
}

export async function addToCart(input: { variantId: string; quantityPackages: number; discountPct: number }): Promise<Result<null>> {
  const supabase = await createClient();
  const agentId = await getAgentId(supabase);
  if (!agentId) return { success: false, error: "Not an approved agent" };
  const qty = Math.max(1, Math.floor(input.quantityPackages || 1));

  const ctx = await loadPricing(supabase, input.variantId);
  if (!ctx.success) return ctx;
  const amt = lineAmounts(ctx.data, qty, input.discountPct);

  const orderId = await getOrCreateCartId(supabase, agentId);

  const row = {
    order_id: orderId, variant_id: input.variantId,
    product_name: ctx.data.productName, variant_label: ctx.data.variantLabel, sku: ctx.data.sku,
    packaging_name: ctx.data.packagingName, pieces_per_package: ctx.data.piecesPerPackage,
    base_qty_per_package: ctx.data.baseQtyPerPackage, unit_symbol: ctx.data.unitSymbol,
    unit_price_cents: ctx.data.gbpRateCents, quantity_packages: qty, discount_pct: amt.d,
    line_subtotal_cents: amt.lineSubtotal, line_total_cents: amt.lineTotal,
    commission_pct: amt.commissionPct, commission_cents: amt.commissionCents,
  };

  // One line per variant: replace if already in cart.
  const { data: existing } = await supabase.from("agent_order_items").select("id").eq("order_id", orderId).eq("variant_id", input.variantId).maybeSingle();
  if (existing) await supabase.from("agent_order_items").update(row).eq("id", existing.id);
  else await supabase.from("agent_order_items").insert(row);

  await recomputeTotals(supabase, orderId);
  revalidatePath("/cart");
  return { success: true, data: null };
}

export async function updateCartItem(input: { itemId: string; quantityPackages: number; discountPct: number }): Promise<Result<null>> {
  const supabase = await createClient();
  const agentId = await getAgentId(supabase);
  if (!agentId) return { success: false, error: "Not an approved agent" };

  const { data: item } = await supabase.from("agent_order_items").select("order_id, variant_id").eq("id", input.itemId).single();
  if (!item?.variant_id) return { success: false, error: "Item not found" };
  const ctx = await loadPricing(supabase, item.variant_id);
  if (!ctx.success) return ctx;
  const qty = Math.max(1, Math.floor(input.quantityPackages || 1));
  const amt = lineAmounts(ctx.data, qty, input.discountPct);

  await supabase.from("agent_order_items").update({
    quantity_packages: qty, discount_pct: amt.d,
    line_subtotal_cents: amt.lineSubtotal, line_total_cents: amt.lineTotal,
    commission_pct: amt.commissionPct, commission_cents: amt.commissionCents,
  }).eq("id", input.itemId);
  await recomputeTotals(supabase, item.order_id);
  revalidatePath("/cart");
  return { success: true, data: null };
}

export async function removeCartItem(itemId: string): Promise<Result<null>> {
  const supabase = await createClient();
  const agentId = await getAgentId(supabase);
  if (!agentId) return { success: false, error: "Not an approved agent" };
  const { data: item } = await supabase.from("agent_order_items").select("order_id").eq("id", itemId).single();
  await supabase.from("agent_order_items").delete().eq("id", itemId);
  if (item?.order_id) await recomputeTotals(supabase, item.order_id);
  revalidatePath("/cart");
  return { success: true, data: null };
}

export async function placeOrder(input: { customerName: string; customerCompany: string; deliveryAddress: string; notes?: string }): Promise<Result<{ code: string }>> {
  const supabase = await createClient();
  const agentId = await getAgentId(supabase);
  if (!agentId) return { success: false, error: "Not an approved agent" };
  if (!input.customerName.trim() || !input.deliveryAddress.trim()) return { success: false, error: "Customer name and delivery address are required." };

  const { data: cart } = await supabase.from("agent_orders")
    .select("id, code, agent_order_items(id)").eq("agent_user_id", agentId).eq("status", "cart").maybeSingle();
  if (!cart) return { success: false, error: "Your cart is empty." };
  if (!cart.agent_order_items || cart.agent_order_items.length === 0) return { success: false, error: "Your cart is empty." };

  const { error } = await supabase.from("agent_orders").update({
    status: "submitted", submitted_at: new Date().toISOString(),
    customer_name: input.customerName.trim(), customer_company: input.customerCompany.trim() || null,
    delivery_address: input.deliveryAddress.trim(), notes: input.notes?.trim() || null,
  }).eq("id", cart.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/cart");
  revalidatePath("/orders");
  return { success: true, data: { code: cart.code } };
}

export async function getMyOrders(): Promise<Result<CartOrder[]>> {
  const supabase = await createClient();
  const agentId = await getAgentId(supabase);
  if (!agentId) return { success: false, error: "Not an approved agent" };
  const { data } = await supabase.from("agent_orders")
    .select("*, agent_order_items(*)").eq("agent_user_id", agentId).neq("status", "cart").order("submitted_at", { ascending: false });
  return { success: true, data: (data || []).map(toOrder) };
}
