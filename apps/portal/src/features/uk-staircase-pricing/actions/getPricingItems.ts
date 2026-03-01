"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { PricingItemDb, ActionResult } from "../types";

/**
 * Get all UK staircase pricing items
 */
export async function getPricingItems(): Promise<ActionResult<PricingItemDb[]>> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();

  // Note: Using type assertion because uk_staircase_pricing isn't in generated Supabase types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("uk_staircase_pricing")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch pricing items:", error);
    return {
      success: false,
      error: "Failed to fetch pricing items",
      code: "FETCH_FAILED",
    };
  }

  return {
    success: true,
    data: data as PricingItemDb[],
  };
}
