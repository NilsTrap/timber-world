"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";
import type { ActionResult, OrganisationOption } from "../types";

/**
 * Get Active Organisations
 *
 * Fetches all active organisations for use in form dropdowns.
 * Allowed for admins and non-admin users with orders.customer-select module.
 */
export async function getActiveOrganisations(): Promise<ActionResult<OrganisationOption[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    const userOrgId = session.currentOrganizationId || session.organisationId;
    const canSelectCustomer = await orgHasModule(userOrgId, "orders.customer-select");
    if (!canSelectCustomer) {
      return { success: false, error: "Permission denied", code: "FORBIDDEN" };
    }
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organisations")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");

  if (error) {
    console.error("Failed to fetch organisations:", error);
    return { success: false, error: "Failed to fetch organisations", code: "QUERY_FAILED" };
  }

  return { success: true, data: data as OrganisationOption[] };
}
