"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isOrganisationUser, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bulk add packages to a tracking set.
 *
 * Uses upsert with ignoreDuplicates to handle packages that are already in the set.
 * Returns count of packages actually added.
 *
 * Multi-tenancy:
 * - Organisation users can only modify their own organisation's sets
 * - Super Admin can modify any set
 */
export async function addTrackingPackages(
  trackingSetId: string,
  packageIds: string[]
): Promise<ActionResult<{ addedCount: number }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!trackingSetId || !UUID_REGEX.test(trackingSetId)) {
    return { success: false, error: "Invalid tracking set ID", code: "INVALID_INPUT" };
  }

  if (!packageIds || packageIds.length === 0) {
    return { success: true, data: { addedCount: 0 } };
  }

  // Validate all package IDs
  for (const id of packageIds) {
    if (!UUID_REGEX.test(id)) {
      return { success: false, error: "Invalid package ID in list", code: "INVALID_INPUT" };
    }
  }

  const supabase = await createClient();

  // Verify ownership of tracking set
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

  // Build insert rows
  const rows = packageIds.map((packageId) => ({
    tracking_set_id: trackingSetId,
    package_id: packageId,
  }));

  // Use upsert with ignoreDuplicates to skip already-existing rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("production_tracking_packages")
    .upsert(rows, { onConflict: "tracking_set_id,package_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    return { success: false, error: error.message, code: "INSERT_FAILED" };
  }

  revalidatePath("/production");

  return { success: true, data: { addedCount: data?.length ?? 0 } };
}
