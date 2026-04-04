"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { VALID_REFERENCE_TABLES, type ReferenceTableName } from "@/features/reference-data/types";

/**
 * Exclude a reference value from all active organisations except the specified one.
 * Used when adding a new option that should only be visible to one organisation.
 */
export async function excludeRefValueFromOtherOrgs(
  keepOrgId: string,
  refTable: ReferenceTableName,
  refValueId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  if (!VALID_REFERENCE_TABLES.includes(refTable)) {
    return { success: false, error: "Invalid reference table" };
  }

  const supabase = await createClient();

  // Get all active organisations except the one to keep
  const { data: orgs, error: orgsError } = await supabase
    .from("organisations")
    .select("id")
    .eq("is_active", true)
    .neq("id", keepOrgId);

  if (orgsError) {
    return { success: false, error: orgsError.message };
  }

  if (!orgs || orgs.length === 0) return { success: true };

  // Insert exclusion records for all other orgs
  const rows = orgs.map((org: any) => ({
    organisation_id: org.id,
    ref_table: refTable,
    ref_value_id: refValueId,
  }));

  const { error: insertError } = await (supabase as any)
    .from("organisation_ref_exclusions")
    .insert(rows);

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  return { success: true };
}
