"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ProductionListItem, ActionResult } from "../types";

/**
 * Fetch draft production entries with joined process name.
 * Ordered by most recently created first.
 */
export async function getDraftProductions(): Promise<
  ActionResult<ProductionListItem[]>
> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, production_date, status, created_at, ref_processes(value)")
    .eq("created_by", session.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  const items: ProductionListItem[] = (data ?? []).map((row: any) => ({
    id: row.id,
    processName: row.ref_processes?.value ?? "Unknown",
    productionDate: row.production_date,
    status: row.status,
    createdAt: row.created_at,
  }));

  return { success: true, data: items };
}
