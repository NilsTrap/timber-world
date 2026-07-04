"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isAdmin } from "@/lib/auth";
import type { AuditActionResult, AuditLogEntry, AuditLogFilters } from "../types";

/**
 * Q5.2 · Read the platform action audit log (newest-first), admin-only.
 *
 * The action_audit_log RLS restricts SELECT to platform admins, so reads go
 * through the service-role client and the app-level isAdmin() gate is the
 * authority (same pattern as getUserLoginHistory) — a role="admin" user who is
 * not a platform admin would otherwise get zero rows from the scoped client.
 */
export async function getAuditLog(
  filters: AuditLogFilters = {},
): Promise<AuditActionResult<AuditLogEntry[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied" };

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from("action_audit_log")
    .select(
      "id, created_at, action, resource_type, resource_id, organisation_id, actor_type, actor_user_id, actor_label, metadata, ip, user_agent",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.actorType) query = query.eq("actor_type", filters.actorType);
  if (filters.resourceType) query = query.eq("resource_type", filters.resourceType);
  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim().replace(/[%,]/g, "");
    query = query.or(
      `action.ilike.%${s}%,actor_label.ilike.%${s}%,resource_id.ilike.%${s}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch audit log:", error);
    return { success: false, error: "Failed to fetch audit log" };
  }

  const entries: AuditLogEntry[] = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []) as any[]
  ).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    at: row.created_at as string,
    action: row.action as string,
    resourceType: row.resource_type as string,
    resourceId: (row.resource_id as string | null) ?? null,
    organisationId: (row.organisation_id as string | null) ?? null,
    actorType: (row.actor_type as "human" | "service") ?? "human",
    actorUserId: (row.actor_user_id as string | null) ?? null,
    actorLabel: (row.actor_label as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    ip: (row.ip as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null,
  }));

  return { success: true, data: entries };
}

/**
 * Distinct resource_type values present in the log — feeds the view's
 * resource-type filter dropdown. Admin-only, same gate as getAuditLog.
 */
export async function getAuditResourceTypes(): Promise<AuditActionResult<string[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied" };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("action_audit_log")
    .select("resource_type")
    .order("resource_type", { ascending: true })
    .limit(2000);

  if (error) {
    console.error("Failed to fetch audit resource types:", error);
    return { success: false, error: "Failed to fetch resource types" };
  }

  const set = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    if (row.resource_type) set.add(row.resource_type as string);
  }
  return { success: true, data: Array.from(set).sort() };
}
