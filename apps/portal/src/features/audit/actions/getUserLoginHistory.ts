"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isAdmin } from "@/lib/auth";
import type { AuditActionResult, LoginHistoryEntry } from "../types";

/**
 * Return the recent login history for a portal user, newest-first.
 *
 * Cross-user visibility is admin-only (mirrors person-detail gating): gated on
 * isAdmin(session) at the app layer. Reads go through the service-role client
 * because login_events RLS restricts SELECT to platform admins — using the
 * scoped client would silently return zero rows for a role="admin" user who is
 * not a platform admin. The app-level gate is the authority here.
 */
export async function getUserLoginHistory(
  portalUserId: string,
  limit = 20
): Promise<AuditActionResult<LoginHistoryEntry[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("login_events")
    .select("id, created_at, ip, user_agent")
    .eq("portal_user_id", portalUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch login history:", error);
    return { success: false, error: "Failed to fetch login history" };
  }

  const entries: LoginHistoryEntry[] = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []) as any[]
  ).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    at: row.created_at as string,
    ip: (row.ip as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null,
  }));

  return { success: true, data: entries };
}
