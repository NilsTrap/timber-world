"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ProductionListItem, ActionResult } from "../types";

/**
 * Fetch draft production entries with joined process name.
 * Ordered by most recently created first.
 *
 * Multi-tenancy:
 * - Organisation users see only their organisation's drafts
 * - Super Admin sees all drafts across all organisations (or filtered by orgIds if provided)
 *
 * @param orgIds - Optional org IDs for Super Admin to filter by specific organisations (multi-select)
 */
export async function getDraftProductions(orgIds?: string[]): Promise<
  ActionResult<ProductionListItem[]>
> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("portal_production_entries")
    .select("id, production_date, status, created_at, organisation_id, created_by, ref_processes(value)")
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  // Organisation users: always filter by their own organisation
  if (isOrganisationUser(session)) {
    query = query.eq("organisation_id", session.organisationId);
  } else if (isSuperAdmin(session) && orgIds && orgIds.length > 0) {
    // Super Admin with org filter: filter by selected organisations (multi-select)
    query = query.in("organisation_id", orgIds);
  }
  // Super Admin without org filter: no filter, sees all drafts

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message, code: "QUERY_FAILED" };
  }

  // Get unique auth user IDs to fetch user names
  const authUserIds = [...new Set((data ?? []).map((row: any) => row.created_by).filter(Boolean))];

  // Fetch user names from portal_users
  let userMap = new Map<string, string>();
  if (authUserIds.length > 0) {
    const { data: users } = await (supabase as any)
      .from("portal_users")
      .select("auth_user_id, name")
      .in("auth_user_id", authUserIds);

    (users ?? []).forEach((u: any) => {
      if (u.auth_user_id) userMap.set(u.auth_user_id, u.name);
    });
  }

  const items: ProductionListItem[] = (data ?? []).map((row: any) => ({
    id: row.id,
    processName: row.ref_processes?.value ?? "Unknown",
    productionDate: row.production_date,
    status: row.status,
    createdAt: row.created_at,
    createdByName: row.created_by ? userMap.get(row.created_by) ?? null : null,
  }));

  return { success: true, data: items };
}
