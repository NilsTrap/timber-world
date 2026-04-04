"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface ActivityLogEntry {
  id: string;
  action: string;
  userEmail: string | null;
  createdAt: string;
}

/**
 * Get Production Activity Log
 *
 * Fetches the full activity log for a production entry, ordered newest first.
 */
export async function getProductionActivityLog(
  productionEntryId: string
): Promise<ActionResult<ActivityLogEntry[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("production_activity_log")
    .select("id, action, user_email, created_at")
    .eq("production_entry_id", productionEntryId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getProductionActivityLog] Failed:", error);
    return { success: false, error: "Failed to fetch activity log", code: "FETCH_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: ActivityLogEntry[] = (data || []).map((row: any) => ({
    id: row.id,
    action: row.action,
    userEmail: row.user_email,
    createdAt: row.created_at,
  }));

  return { success: true, data: entries };
}
