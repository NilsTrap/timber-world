"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../../types";

export interface TrackingSetListItem {
  id: string;
  name: string;
  packageCount: number;
  createdAt: string;
}

/**
 * List all production tracking sets for the user's organisation.
 *
 * Multi-tenancy:
 * - Organisation users see only their own organisation's sets
 * - Super Admin sees all sets
 */
export async function getTrackingSets(): Promise<
  ActionResult<TrackingSetListItem[]>
> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("production_tracking_sets")
    .select("id, name, created_at, production_tracking_packages(count)")
    .order("created_at", { ascending: false });

  if (isOrganisationUser(session) && !isSuperAdmin(session)) {
    query = query.eq("organisation_id", session.organisationId);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message, code: "QUERY_FAILED" };
  }

  const items: TrackingSetListItem[] = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    packageCount: row.production_tracking_packages?.[0]?.count ?? 0,
    createdAt: row.created_at,
  }));

  return { success: true, data: items };
}
