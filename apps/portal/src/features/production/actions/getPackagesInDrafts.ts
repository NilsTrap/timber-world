"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

export interface DraftPackageInfo {
  packageId: string;
  draftId: string;
  processName: string;
  productionDate: string;
}

/**
 * Get all packages that are currently used as inputs in draft production entries.
 * Returns a map of packageId -> draft info for quick lookup.
 */
export async function getPackagesInDrafts(
  orgId?: string
): Promise<ActionResult<DraftPackageInfo[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("portal_production_inputs")
    .select(`
      package_id,
      portal_production_entries!inner(
        id,
        production_date,
        status,
        organisation_id,
        ref_processes(value)
      )
    `)
    .eq("portal_production_entries.status", "draft");

  // Filter by organisation
  if (isOrganisationUser(session)) {
    query = query.eq("portal_production_entries.organisation_id", session.organisationId);
  } else if (isSuperAdmin(session) && orgId) {
    query = query.eq("portal_production_entries.organisation_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch packages in drafts:", error);
    return { success: false, error: error.message, code: "QUERY_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: DraftPackageInfo[] = (data ?? []).map((row: any) => ({
    packageId: row.package_id,
    draftId: row.portal_production_entries?.id,
    processName: row.portal_production_entries?.ref_processes?.value ?? "Unknown",
    productionDate: row.portal_production_entries?.production_date,
  }));

  return { success: true, data: result };
}
