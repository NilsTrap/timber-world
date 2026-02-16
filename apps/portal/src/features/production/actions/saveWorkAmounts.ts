"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser } from "@/lib/auth";
import type { ActionResult } from "../types";

interface SaveWorkAmountsInput {
  productionEntryId: string;
  plannedWork: number | null;
  actualWork: number | null;
}

/**
 * Save planned and actual work amounts for a production entry.
 */
export async function saveWorkAmounts(
  input: SaveWorkAmountsInput
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = await createClient();

  // First verify the user has access to this entry
  const { data: entry, error: fetchError } = await (supabase as any)
    .from("portal_production_entries")
    .select("id, organisation_id")
    .eq("id", input.productionEntryId)
    .single();

  if (fetchError || !entry) {
    return { success: false, error: "Production entry not found" };
  }

  // Organisation users can only update their own organisation's entries
  if (isOrganisationUser(session) && entry.organisation_id !== session.organisationId) {
    return { success: false, error: "Permission denied" };
  }

  // Update the work amounts
  const { data, error } = await (supabase as any)
    .from("portal_production_entries")
    .update({
      planned_work: input.plannedWork,
      actual_work: input.actualWork,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.productionEntryId)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { id: data.id } };
}
