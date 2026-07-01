"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { getAccessProfile } from "@/lib/access";
import { resolveFieldAccess } from "../services/dealFields";
import type { ActionResult } from "../types";

export interface StaircaseCode {
  id: string;
  code: string;
  name: string;
  productType: string;
  thicknessMm: number;
  widthMm: number;
  lengthMm: number;
  riserMm: number | null;
  workCostCents: number;
  transportCostCents: number | null;
  finalPriceCents: number | null;
  eurPerM3Cents: number | null;
}

/**
 * Get active UK staircase pricing codes for the order product form.
 * Available to any authenticated user.
 */
export async function getStaircaseCodes(): Promise<ActionResult<StaircaseCode[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  // The staircase code is a product identifier (e.g. "Tread40") needed to render
  // the read-only "Code" column on every orders tab — including Production, which
  // producer (Wood ART) users see. So gate on plain orders.view, not the pricing
  // tab. The embedded values project through the E4 field wall: the final price
  // is deal_terms (customer-facing), the cost components (work/transport/eur-per-m³)
  // are margin — a sell-side group must not receive the margin inputs.
  let seeFinalPrice = true;
  let seeCostComponents = true;
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("orders.view")) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
    const access = resolveFieldAccess(await getAccessProfile(session.portalUserId, orgId));
    seeFinalPrice = access.domainVisible("deal_terms");
    seeCostComponents = access.domainVisible("margin");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("uk_staircase_pricing")
    .select("id, code, name, product_type, thickness_mm, width_mm, length_mm, riser_mm, work_cost_cents, transport_cost_cents, final_price_cents, eur_per_m3_cents")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getStaircaseCodes] Failed:", error);
    return { success: false, error: "Failed to fetch staircase codes", code: "FETCH_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const codes: StaircaseCode[] = (data || []).map((row: any) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    productType: row.product_type,
    thicknessMm: row.thickness_mm,
    widthMm: row.width_mm,
    lengthMm: row.length_mm,
    riserMm: row.riser_mm ?? null,
    // Cost components gated on margin, final price on deal_terms (Code label +
    // dimensions still work for everyone).
    workCostCents: seeCostComponents ? (row.work_cost_cents ?? 0) : 0,
    transportCostCents: seeCostComponents ? (row.transport_cost_cents ?? null) : null,
    finalPriceCents: seeFinalPrice ? (row.final_price_cents ?? null) : null,
    eurPerM3Cents: seeCostComponents ? (row.eur_per_m3_cents ?? null) : null,
  }));

  return { success: true, data: codes };
}
