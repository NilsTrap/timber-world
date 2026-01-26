"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
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
 * Get Reference Dropdowns
 *
 * Fetches all 7 reference table active options for the package entry form.
 * Returns combined result with all dropdown options.
 * Available to any authenticated user (admins and org users).
 */
export async function getReferenceDropdowns(): Promise<ActionResult<ReferenceDropdowns>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  // Reference data is read-only and available to all authenticated users

  const supabase = await createClient();

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

      return { data: data as ReferenceOption[] };
    })
  );

  // Check for errors
  const failedTable = results.find((r) => "error" in r);
  if (failedTable && "error" in failedTable) {
    return {
      success: false,
      error: `Failed to fetch reference data (${failedTable.error})`,
      code: "QUERY_FAILED",
    };
  }

  // Build the combined result
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
