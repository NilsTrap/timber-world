"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult, OrganisationOption } from "../types";

/**
 * Get User Organisation
 *
 * Fetches the current user's organisation details.
 * Returns null if the user has no organisation assigned.
 */
export async function getUserOrganisation(): Promise<ActionResult<OrganisationOption | null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: true, data: null };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organisations")
    .select("id, code, name")
    .eq("id", session.organisationId)
    .single();

  if (error) {
    console.error("Failed to fetch user organisation:", error);
    return { success: false, error: "Failed to fetch organisation", code: "QUERY_FAILED" };
  }

  return { success: true, data: data as OrganisationOption };
}
