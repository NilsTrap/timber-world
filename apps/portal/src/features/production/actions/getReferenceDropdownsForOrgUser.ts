"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrgUser, isSuperAdmin } from "@/lib/auth";
import { getOrgExcludedRefValues } from "@/lib/auth/getOrgRefExclusions";
import type { ActionResult, ReferenceDropdowns, ReferenceOption } from "../types";

const REFERENCE_TABLES = [
  { table: "ref_product_names", key: "productNames" },
  { table: "ref_wood_species", key: "woodSpecies" },
  { table: "ref_humidity", key: "humidity" },
  { table: "ref_types", key: "types" },
  { table: "ref_processing", key: "processing" },
  { table: "ref_fsc", key: "fsc" },
  { table: "ref_quality", key: "quality" },
] as const;

/**
 * Get Reference Dropdowns for Org User
 *
 * Fetches all 7 reference table active options for the production output form.
 * Filters out values excluded for the user's organisation.
 * Accessible by org users and Super Admin.
 */
export async function getReferenceDropdownsForOrgUser(): Promise<ActionResult<ReferenceDropdowns>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  // Allow org users and Super Admin
  if (!isOrgUser(session) && !isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();
  const orgId = session.currentOrganizationId || session.organisationId || null;
  const exclusions = await getOrgExcludedRefValues(orgId);

  // Fetch all 7 tables in parallel
  const results = await Promise.all(
    REFERENCE_TABLES.map(async ({ table }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from(table)
        .select("id, value")
        .eq("is_active", true)
        .order("sort_order")
        .order("value");

      if (error) {
        console.error(`Failed to fetch ${table}:`, error);
        return { error: table };
      }

      // Filter out excluded values for this org
      const excluded = exclusions.get(table);
      const filtered = excluded
        ? (data as ReferenceOption[]).filter((d) => !excluded.has(d.id))
        : (data as ReferenceOption[]);

      return { data: filtered };
    })
  );

  const failedTable = results.find((r) => "error" in r);
  if (failedTable && "error" in failedTable) {
    return {
      success: false,
      error: `Failed to fetch reference data (${failedTable.error})`,
      code: "QUERY_FAILED",
    };
  }

  const dropdowns: ReferenceDropdowns = {
    productNames: (results[0] as { data: ReferenceOption[] }).data,
    woodSpecies: (results[1] as { data: ReferenceOption[] }).data,
    humidity: (results[2] as { data: ReferenceOption[] }).data,
    types: (results[3] as { data: ReferenceOption[] }).data,
    processing: (results[4] as { data: ReferenceOption[] }).data,
    fsc: (results[5] as { data: ReferenceOption[] }).data,
    quality: (results[6] as { data: ReferenceOption[] }).data,
  };

  return { success: true, data: dropdowns };
}
