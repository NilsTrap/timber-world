/**
 * Spine sibling resolution (spec §2.3 — "the connection is the spine; it does not
 * live inside any deal"). Given a sell deal, find its bilateral counterpart BUY
 * leg(s) on the SAME spine by shared `spine_id` + party roles, and sum their own
 * line items. This is what the owner's margin block reads (§5.3): sell-total −
 * buy-total, where the buy-total comes from the sibling buy leg, never from
 * buy-side lines conflated onto the sell order.
 *
 * IMPORTANT (§2.3): the sibling is resolved via `spine_id`, NOT via the deal-held
 * `upstream_deal_id` pointer — that pointer is a legacy/internal cache only.
 *
 * IMPORTANT (§9.1): cross-leg cost data never reaches ordinary users. Callers MUST
 * gate this behind owner/platform-admin. It uses the admin client so the owner's
 * legitimate cross-leg read isn't fought by per-deal RLS.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { lineTotalCents } from "./documents/assemble";
import { mapLineItem, type OrderLineItem } from "./dealModel";

export interface SpineBuyLegCost {
  /** Number of buy legs found on the spine (a spine can source from >1 supplier). */
  legCount: number;
  /** Summed line total (cents) of every sibling buy leg's own line items. */
  totalCents: number;
  /** True when at least one sibling buy line carries a price (else margin is provisional). */
  priced: boolean;
}

interface SellLegLike {
  id: string;
  spineId: string | null;
  dealKind: string;
  seller: { id: string | null };
}

/**
 * Resolve and sum the cost of a sell deal's spine-sibling BUY leg(s).
 *
 * Discriminator (spec §2.4): on a bilateral spine the house/orchestrator org is
 * the SELLER on the sell leg and the BUYER on the buy leg. So the buy leg is the
 * `purchase_only` deal on this spine whose `buyer_organisation_id` equals this
 * sell leg's seller (the house). Corroborated by `deal_kind = 'purchase_only'`.
 *
 * Returns null when the deal has no spine, is itself a buy leg (nothing sourced
 * beneath it), or the house org is unknown. Returns a zero-cost/legCount=0 result
 * is folded into null (no buy leg yet) so the caller shows "provisional".
 */
export async function getSpineBuyLegCost(deal: SellLegLike): Promise<SpineBuyLegCost | null> {
  if (!deal.spineId) return null;
  if (deal.dealKind === "purchase_only") return null; // a buy leg has no buy leg beneath it
  const houseOrgId = deal.seller.id;
  if (!houseOrgId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: legs } = await admin
    .from("orders")
    .select("id")
    .eq("spine_id", deal.spineId)
    .eq("deal_kind", "purchase_only")
    .eq("buyer_organisation_id", houseOrgId)
    .neq("id", deal.id);
  const buyLegIds = (legs ?? []).map((r: { id: string }) => r.id);
  if (buyLegIds.length === 0) return null;

  const { data: lineRows } = await admin
    .from("order_line_items")
    .select("*")
    .in("order_id", buyLegIds);
  const lines: OrderLineItem[] = ((lineRows ?? []) as Record<string, unknown>[]).map(mapLineItem);
  const totalCents = lines.reduce((s, li) => s + lineTotalCents(li), 0);
  const priced = lines.some((li) => li.unitPriceCents != null || li.lineTotalCents != null);
  return { legCount: buyLegIds.length, totalCents, priced };
}
