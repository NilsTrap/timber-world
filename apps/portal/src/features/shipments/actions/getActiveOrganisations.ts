"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult, OrganisationOption } from "../types";

/**
 * Get Active Organisations
 *
 * Fetches all active organisations for use in shipment form dropdowns.
 * Admin only.
 */
export async function getActiveOrganisations(): Promise<ActionResult<OrganisationOption[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("parties")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");

  if (error) {
    console.error("Failed to fetch organisations:", error);
    return { success: false, error: "Failed to fetch organisations", code: "QUERY_FAILED" };
  }

  return { success: true, data: data as OrganisationOption[] };
}
