"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Get the set of excluded reference value IDs for an organisation.
 * Returns a Map of refTable → Set of excluded value IDs.
 * Returns empty map if orgId is null (admin with no org context = see everything).
 */
export async function getOrgExcludedRefValues(
  orgId: string | null
): Promise<Map<string, Set<string>>> {
  if (!orgId) return new Map();

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("organisation_ref_exclusions")
    .select("ref_table, ref_value_id")
    .eq("organisation_id", orgId);

  if (error || !data) return new Map();

  const result = new Map<string, Set<string>>();
  for (const row of data) {
    if (!result.has(row.ref_table)) {
      result.set(row.ref_table, new Set());
    }
    result.get(row.ref_table)!.add(row.ref_value_id);
  }

  return result;
}
