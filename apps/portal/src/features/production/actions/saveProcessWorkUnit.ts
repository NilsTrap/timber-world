"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

interface SaveProcessWorkUnitInput {
  processId: string;
  workUnit: string;
}

/**
 * Save the work unit for a process.
 * Work unit defines how work is measured (m, m², m³, pkg, h).
 */
export async function saveProcessWorkUnit(
  input: SaveProcessWorkUnitInput
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("ref_processes")
    .update({
      work_unit: input.workUnit || null,
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
