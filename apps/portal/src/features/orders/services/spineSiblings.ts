/**
 * Spine sibling / chain resolution (spec §2.3 — "the connection is the spine; it
 * does not live inside any deal"). All resolution is by the SHARED `spine_id` +
 * party roles, NEVER via the deal-held `upstream_deal_id` pointer (a legacy cache).
 *
 * IMPORTANT (§9.1 / §6.2): cross-leg data (buy-leg cost, the full chain) never
 * reaches ordinary users. Callers MUST gate these behind owner/platform-admin (or,
 * for the sourcing summary, suppliers-book rights). They use the admin client so an
 * owner's legitimate cross-leg read isn't fought by per-deal RLS.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { lineTotalCents } from "./documents/assemble";
import { mapLineItem, type OrderLineItem } from "./dealModel";

/** One BUY leg on the spine, with the details B4 (sourcing state) needs. */
export interface SpineBuyLegRef {
  orderId: string;
  dealCode: string | null;
  lifecycleStage: string | null;
  /** The supplier = the SELLER on a buy leg (§2.4). Only surface to supplier_identity viewers. */
  supplierName: string | null;
  totalCents: number;
  priced: boolean;
}

export interface SpineBuyLegs {
  legs: SpineBuyLegRef[];
  /** Summed own-line total across every sibling buy leg (for the owner margin block). */
  totalCents: number;
  /** True when any sibling buy line carries a price (else margin stays provisional). */
  priced: boolean;
}

interface SellLegLike {
  id: string;
  spineId: string | null;
  dealKind: string;
  seller: { id: string | null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumLegTotals(lineRows: any[]): { byOrder: Map<string, { total: number; priced: boolean }> } {
  const byOrder = new Map<string, { total: number; priced: boolean }>();
  for (const r of (lineRows ?? []) as Record<string, unknown>[]) {
    const li: OrderLineItem = mapLineItem(r);
    const oid = (r.order_id as string) ?? "";
    const cur = byOrder.get(oid) ?? { total: 0, priced: false };
    cur.total += lineTotalCents(li);
    if (li.unitPriceCents != null || li.lineTotalCents != null) cur.priced = true;
    byOrder.set(oid, cur);
  }
  return { byOrder };
}

/**
 * Resolve the BUY leg(s) on a sell deal's spine, with details + summed cost.
 *
 * Discriminator (§2.4): the house/orchestrator org is the SELLER on the sell leg
 * and the BUYER on the buy leg. So a buy leg = the `purchase_only` deal on this
 * spine whose `buyer_organisation_id` equals this sell leg's seller (the house).
 *
 * Returns null when the deal has no spine, is itself a buy leg, or no buy leg
 * exists yet. OWNER/sourcing-gated — the CALLER enforces §9.1.
 */
export async function getSpineBuyLegs(deal: SellLegLike): Promise<SpineBuyLegs | null> {
  if (!deal.spineId) return null;
  if (deal.dealKind === "purchase_only") return null; // a buy leg has no buy leg beneath it
  const houseOrgId = deal.seller.id;
  if (!houseOrgId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: legRows } = await admin
    .from("orders")
    .select("id, deal_code, lifecycle_stage, seller:organisations!orders_seller_organisation_id_fkey(name)")
    .eq("spine_id", deal.spineId)
    .eq("deal_kind", "purchase_only")
    .eq("buyer_organisation_id", houseOrgId)
    // Cancelled buy legs (e.g. after a B2 replace-supplier) must not count toward
    // margin or the "sourced" state — the active sourcing is the surviving leg.
    .neq("lifecycle_stage", "cancelled")
    .neq("id", deal.id)
    // Deterministic order so callers that use legs[0] (B2 replace) act on a stable
    // leg. There should be ONE active buy leg per spine (startSourcing enforces it).
    .order("created_at", { ascending: true });
  const legOrders = (legRows ?? []) as Array<{ id: string; deal_code: string | null; lifecycle_stage: string | null; seller: { name: string | null } | null }>;
  if (legOrders.length === 0) return null;

  const { data: lineRows } = await admin
    .from("order_line_items")
    .select("order_id, unit_price_cents, line_total_cents, unit, volume_m3, pieces")
    .in("order_id", legOrders.map((o) => o.id));
  const { byOrder } = sumLegTotals(lineRows);

  const legs: SpineBuyLegRef[] = legOrders.map((o) => {
    const agg = byOrder.get(o.id) ?? { total: 0, priced: false };
    return {
      orderId: o.id,
      dealCode: o.deal_code ?? null,
      lifecycleStage: o.lifecycle_stage ?? null,
      supplierName: o.seller?.name ?? null,
      totalCents: agg.total,
      priced: agg.priced,
    };
  });
  return {
    legs,
    totalCents: legs.reduce((s, l) => s + l.totalCents, 0),
    priced: legs.some((l) => l.priced),
  };
}

/** One leg on a spine — for the owner chain card (B3). */
export interface SpineLegRef {
  orderId: string;
  dealCode: string | null;
  code: string;
  dealKind: string;
  sellerName: string | null;
  buyerName: string | null;
  lifecycleStage: string | null;
  status: string | null;
  ownTotalCents: number;
  priced: boolean;
}

/**
 * List EVERY leg on a spine (both directions) with its own total — the owner chain
 * card (§6.2). Resolved via `spine_id` (§2.3). OWNER-gated by the CALLER.
 * Unlike getSpineBuyLegs this does NOT fold a single-leg spine to null — the chain
 * card shows the spine even when only one leg exists.
 */
export async function getSpineLegs(spineId: string | null): Promise<SpineLegRef[]> {
  if (!spineId) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: legRows } = await admin
    .from("orders")
    .select("id, code, deal_code, deal_kind, lifecycle_stage, status, seller:organisations!orders_seller_organisation_id_fkey(name), buyer:organisations!orders_buyer_organisation_id_fkey(name), customer:organisations!orders_customer_organisation_id_fkey(name)")
    .eq("spine_id", spineId)
    .order("created_at", { ascending: true });
  const legOrders = (legRows ?? []) as Array<{
    id: string; code: string; deal_code: string | null; deal_kind: string | null;
    lifecycle_stage: string | null; status: string | null;
    seller: { name: string | null } | null; buyer: { name: string | null } | null; customer: { name: string | null } | null;
  }>;
  if (legOrders.length === 0) return [];

  const { data: lineRows } = await admin
    .from("order_line_items")
    .select("order_id, unit_price_cents, line_total_cents, unit, volume_m3, pieces")
    .in("order_id", legOrders.map((o) => o.id));
  const { byOrder } = sumLegTotals(lineRows);

  return legOrders.map((o) => {
    const agg = byOrder.get(o.id) ?? { total: 0, priced: false };
    return {
      orderId: o.id,
      dealCode: o.deal_code ?? null,
      code: o.code,
      dealKind: o.deal_kind ?? "buy_sell",
      sellerName: o.seller?.name ?? null,
      // buyer embed is canonical since E4; fall back to customer for legacy rows
      buyerName: o.buyer?.name ?? o.customer?.name ?? null,
      lifecycleStage: o.lifecycle_stage ?? null,
      status: o.status ?? null,
      ownTotalCents: agg.total,
      priced: agg.priced,
    };
  });
}
