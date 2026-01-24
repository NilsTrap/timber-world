"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ProductionHistoryItem, ActionResult } from "../types";

/**
 * Fetch validated production entries with calculated totals.
 * Ordered by validated_at (newest first).
 */
export async function getValidatedProductions(): Promise<
  ActionResult<ProductionHistoryItem[]>
> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_production_entries")
    .select(
      "id, production_date, total_input_m3, total_output_m3, outcome_percentage, waste_percentage, validated_at, ref_processes(value)"
    )
    .eq("created_by", session.id)
    .eq("status", "validated")
    .order("validated_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: ProductionHistoryItem[] = (data ?? []).map((row: any) => ({
    id: row.id,
    processName: row.ref_processes?.value ?? "Unknown",
    productionDate: row.production_date,
    totalInputM3: row.total_input_m3 ?? 0,
    totalOutputM3: row.total_output_m3 ?? 0,
    outcomePercentage: row.outcome_percentage ?? 0,
    wastePercentage: row.waste_percentage ?? 0,
    validatedAt: row.validated_at,
  }));

  return { success: true, data: items };
}
