"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
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
    workCostCents: row.work_cost_cents ?? 0,
    transportCostCents: row.transport_cost_cents ?? null,
    finalPriceCents: row.final_price_cents ?? null,
    eurPerM3Cents: row.eur_per_m3_cents ?? null,
  }));

  return { success: true, data: codes };
}
