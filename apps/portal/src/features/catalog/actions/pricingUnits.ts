"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult, PricingUnit, CalcMethod } from "../types";

function toUnit(row: any): PricingUnit {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    calcMethod: row.calc_method,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export async function getPricingUnits(): Promise<ActionResult<PricingUnit[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_pricing_units")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []).map(toUnit) };
}

export interface SavePricingUnitInput {
  id?: string;
  code: string;
  name: string;
  symbol: string;
  calcMethod: CalcMethod;
  isActive?: boolean;
  sortOrder?: number;
}

export async function savePricingUnit(input: SavePricingUnitInput): Promise<ActionResult<PricingUnit>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const payload = {
    code: input.code,
    name: input.name,
    symbol: input.symbol,
    calc_method: input.calcMethod,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  };

  let result;
  if (input.id) {
    result = await (supabase as any).from("catalog_pricing_units").update(payload).eq("id", input.id).select().single();
  } else {
    result = await (supabase as any).from("catalog_pricing_units").insert(payload).select().single();
  }

  if (result.error) {
    if (result.error.code === "23505") return { success: false, error: `Unit code "${input.code}" already exists`, code: "DUPLICATE" };
    return { success: false, error: result.error.message };
  }

  revalidatePath("/admin/catalog/pricing-units");
  return { success: true, data: toUnit(result.data) };
}

export async function deletePricingUnit(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  const { error } = await (supabase as any).from("catalog_pricing_units").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") return { success: false, error: "Cannot delete: a category uses this pricing unit.", code: "IN_USE" };
    return { success: false, error: error.message };
  }
  revalidatePath("/admin/catalog/pricing-units");
  return { success: true, data: null };
}
