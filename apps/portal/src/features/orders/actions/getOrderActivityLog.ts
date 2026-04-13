"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface OrderActivityEntry {
  id: string;
  action: string;
  details: string | null;
  userName: string | null;
  createdAt: string;
}

export async function getOrderActivityLog(
  orderId: string,
  tab?: string
): Promise<ActionResult<OrderActivityEntry[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("order_activity_log")
    .select("id, action, details, created_at, portal_users(name)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (tab) {
    query = query.eq("tab", tab);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch order activity log:", error);
    return { success: false, error: "Failed to fetch activity log" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: OrderActivityEntry[] = ((data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    action: row.action,
    details: row.details,
    userName: row.portal_users?.name ?? null,
    createdAt: row.created_at,
  }));

  return { success: true, data: entries };
}
