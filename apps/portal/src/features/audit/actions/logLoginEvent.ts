"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Record a successful-login event for a portal user.
 *
 * Fire-and-forget: reads IP + User-Agent from the request headers and inserts a
 * login_events row via the service-role admin client (RLS-bypassing). Wrapped in
 * its own try/catch so it can NEVER block or fail the login flow.
 */
export async function logLoginEvent(
  portalUserId: string,
  email: string
): Promise<void> {
  try {
    const h = await headers();
    // First hop of x-forwarded-for is the real client IP; fall back to x-real-ip.
    const forwardedFor = h.get("x-forwarded-for");
    const ip = forwardedFor
      ? forwardedFor.split(",")[0]?.trim() ?? null
      : h.get("x-real-ip") ?? null;
    const userAgent = h.get("user-agent") ?? null;

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("login_events").insert({
      portal_user_id: portalUserId,
      email,
      ip,
      user_agent: userAgent,
    });
  } catch (err) {
    console.error("Failed to log login event:", err);
  }
}
