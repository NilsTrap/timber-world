"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser } from "@/lib/auth";
import type { ActionResult } from "../types";

interface SavePalletCountInput {
  productionEntryId: string;
  palletCount: number | null;
}

/**
 * Save the pallet count for a production entry.
 *
 * Pallet tracking is currently surfaced only for the Packing process, but the
 * server action accepts any process — the gate is at the UI level. Org users
 * can only update entries from their own organisation.
 */
export async function savePalletCount(
  input: SavePalletCountInput
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (input.palletCount !== null && (!Number.isInteger(input.palletCount) || input.palletCount < 0)) {
    return { success: false, error: "Pallet count must be a non-negative integer", code: "VALIDATION_FAILED" };
  }

  const supabase = await createClient();

  // Verify ownership for org users.
  if (isOrganisationUser(session)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entry } = await (supabase as any)
      .from("portal_production_entries")
      .select("organisation_id")
      .eq("id", input.productionEntryId)
      .single();
    if (!entry || entry.organisation_id !== session.organisationId) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("portal_production_entries")
    .update({
      pallet_count: input.palletCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.productionEntryId);

  if (error) {
    return { success: false, error: error.message, code: "UPDATE_FAILED" };
  }

  revalidatePath(`/production/${input.productionEntryId}`);

  return { success: true, data: { id: input.productionEntryId } };
}
