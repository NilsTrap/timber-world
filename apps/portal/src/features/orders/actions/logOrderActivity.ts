"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Log an activity event for an order, scoped to a specific tab.
 * Fire-and-forget — errors are logged but don't block the caller.
 */
export async function logOrderActivity(
  orderId: string,
  userId: string | null,
  action: string,
  details?: string,
  tab?: string
): Promise<void> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("order_activity_log").insert({
      order_id: orderId,
      user_id: userId,
      action,
      details: details ?? null,
      tab: tab ?? "list",
    });
  } catch (err) {
    console.error("Failed to log order activity:", err);
  }
}
