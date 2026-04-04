"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../../types";

/**
 * Create a new production tracking set.
 *
 * Requires the user to have an organisation context.
 * Looks up portal_users.id from session.id (auth_user_id) since
 * production_tracking_sets.created_by references portal_users(id).
 */
export async function createTrackingSet(
  name: string
): Promise<ActionResult<{ id: string; name: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organisation context", code: "NO_ORGANISATION" };
  }

  const trimmedName = (name ?? "").trim();
  if (!trimmedName) {
    return { success: false, error: "Name is required", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  // Look up portal_users.id from auth user id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalUser } = await (supabase as any)
    .from("portal_users")
    .select("id")
    .eq("auth_user_id", session.id)
    .single();

  if (!portalUser) {
    return { success: false, error: "Portal user not found", code: "USER_NOT_FOUND" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("production_tracking_sets")
    .insert({
      name: trimmedName,
      organisation_id: session.organisationId,
      created_by: portalUser.id,
    })
    .select("id, name")
    .single();

  if (error) {
    return { success: false, error: error.message, code: "INSERT_FAILED" };
  }

  revalidatePath("/production");

  return { success: true, data: { id: data.id, name: data.name } };
}
