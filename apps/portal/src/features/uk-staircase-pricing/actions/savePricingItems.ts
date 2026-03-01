"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { PricingItemUpsert, PricingItemDb, ActionResult } from "../types";

/**
 * Save (upsert) UK staircase pricing items
 * Items with id are updated, items without id are inserted
 */
export async function savePricingItems(
  items: PricingItemUpsert[]
): Promise<ActionResult<PricingItemDb[]>> {
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

  if (items.length === 0) {
    return {
      success: true,
      data: [],
    };
  }

  const supabase = await createClient();

  // Upsert all items
  // Note: Using type assertion because uk_staircase_pricing isn't in generated Supabase types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("uk_staircase_pricing")
    .upsert(items, { onConflict: "id" })
    .select("*");

  if (error) {
    console.error("Failed to save pricing items:", error);
    return {
      success: false,
      error: `Failed to save pricing items: ${error.message}`,
      code: "SAVE_FAILED",
    };
  }

  return {
    success: true,
    data: data as PricingItemDb[],
  };
}
