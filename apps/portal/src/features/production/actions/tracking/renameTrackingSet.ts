"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rename a production tracking set.
 *
 * Multi-tenancy:
 * - Organisation users can only rename their own organisation's sets
 * - Super Admin can rename any set
 */
export async function renameTrackingSet(
  trackingSetId: string,
  name: string
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!trackingSetId || !UUID_REGEX.test(trackingSetId)) {
    return { success: false, error: "Invalid tracking set ID", code: "INVALID_INPUT" };
  }

  const trimmedName = (name ?? "").trim();
  if (!trimmedName) {
    return { success: false, error: "Name is required", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Fetch set to verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: set, error: fetchError } = await (supabase as any)
    .from("production_tracking_sets")
    .select("id, organisation_id")
    .eq("id", trackingSetId)
    .single();

  if (fetchError || !set) {
    return { success: false, error: "Tracking set not found", code: "NOT_FOUND" };
  }

  if (isOrganisationUser(session) && !isSuperAdmin(session) && set.organisation_id !== session.organisationId) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("production_tracking_sets")
    .update({ name: trimmedName, updated_at: new Date().toISOString() })
    .eq("id", trackingSetId);

  if (updateError) {
    return { success: false, error: updateError.message, code: "UPDATE_FAILED" };
  }

  revalidatePath("/production");

  return { success: true, data: null };
}
