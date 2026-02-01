"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { Process, ActionResult } from "../types";

/**
 * Fetch all active processes ordered by sort_order.
 * Used by the production form's process dropdown.
 */
export async function getProcesses(): Promise<ActionResult<Process[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("ref_processes")
    .select("id, code, value, sort_order")
    .eq("is_active", true)
    .order("value", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  const processes: Process[] = (data ?? []).map((row: any) => ({
    id: row.id,
    code: row.code,
    value: row.value,
    sortOrder: row.sort_order,
  }));

  return { success: true, data: processes };
}
