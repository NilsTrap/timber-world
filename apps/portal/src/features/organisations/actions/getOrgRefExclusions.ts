"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";

export interface OrgRefExclusion {
  refTable: string;
  refValueId: string;
}

/**
 * Get all reference value exclusions for an organisation.
 * Returns a list of (refTable, refValueId) pairs that are disabled.
 */
export async function getOrgRefExclusions(
  organisationId: string
): Promise<{ success: true; data: OrgRefExclusion[] } | { success: false; error: string }> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("organisation_ref_exclusions")
    .select("ref_table, ref_value_id")
    .eq("organisation_id", organisationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: (data ?? []).map((row: any) => ({
      refTable: row.ref_table,
      refValueId: row.ref_value_id,
    })),
  };
}
