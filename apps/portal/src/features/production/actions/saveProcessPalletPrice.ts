"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

interface SaveProcessPalletPriceInput {
  processId: string;
  palletPrice: number | null;
}

/**
 * Save the pallet unit price for a process (Reference Data admin).
 *
 * Pallet price is auxiliary to the per-unit work price — Packing entries can
 * use multiple pallets and we want to roll that cost into the entry total.
 * In practice this field is only set for the Packing process, but the schema
 * is generic.
 */
export async function saveProcessPalletPrice(
  input: SaveProcessPalletPriceInput
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }
  // Pallet price is reference data; only platform admins may change it.
  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ref_processes")
    .update({
      pallet_price: input.palletPrice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.processId)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { id: data.id } };
}
