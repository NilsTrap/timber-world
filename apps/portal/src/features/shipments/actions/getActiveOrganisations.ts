"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult, OrganisationOption } from "../types";

/**
 * Get Active Organisations
 *
 * Fetches organisations for use in form dropdowns.
 * - Admins: all active organisations.
 * - Non-admins: only their active trading partners.
 */
export async function getActiveOrganisations(): Promise<ActionResult<OrganisationOption[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Admins see all active organisations
  if (isAdmin(session)) {
    const { data, error } = await client
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

  // Non-admin: only the user's active trading partners
  const userOrgId = session.currentOrganizationId || session.organisationId;

  const { data: partners, error: partnersError } = await client
    .from("organisation_trading_partners")
    .select("partner_organisation_id")
    .eq("organisation_id", userOrgId);

  if (partnersError) {
    return { success: false, error: "Failed to fetch trading partners", code: "QUERY_FAILED" };
  }

  if (!partners || partners.length === 0) {
    return { success: true, data: [] };
  }

  const partnerIds = partners.map(
    (p: { partner_organisation_id: string }) => p.partner_organisation_id
  );

  const { data: orgs, error: orgsError } = await client
    .from("organisations")
    .select("id, code, name")
    .in("id", partnerIds)
    .eq("is_active", true)
    .order("code");

  if (orgsError) {
    console.error("Failed to fetch organisations:", orgsError);
    return { success: false, error: "Failed to fetch organisations", code: "QUERY_FAILED" };
  }

  return { success: true, data: orgs as OrganisationOption[] };
}
