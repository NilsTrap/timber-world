"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import { VALID_REFERENCE_TABLES, type ReferenceTableName } from "@/features/reference-data/types";

/**
 * Update reference value exclusions for an organisation and a specific table.
 * Receives the list of value IDs that should be EXCLUDED (disabled).
 * Replaces all exclusions for the given (org, table) combination.
 */
export async function updateOrgRefExclusions(
  organisationId: string,
  refTable: ReferenceTableName,
  excludedValueIds: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  // Validate table name to prevent injection
  if (!VALID_REFERENCE_TABLES.includes(refTable)) {
    return { success: false, error: "Invalid reference table" };
  }

  const supabase = await createClient();

  // Delete existing exclusions for this org + table
  const { error: deleteError } = await (supabase as any)
    .from("organisation_ref_exclusions")
    .delete()
    .eq("organisation_id", organisationId)
    .eq("ref_table", refTable);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  // Insert new exclusions (if any)
  if (excludedValueIds.length > 0) {
    const rows = excludedValueIds.map((refValueId) => ({
      organisation_id: organisationId,
      ref_table: refTable,
      ref_value_id: refValueId,
    }));

    const { error: insertError } = await (supabase as any)
      .from("organisation_ref_exclusions")
      .insert(rows);

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  return { success: true };
}
