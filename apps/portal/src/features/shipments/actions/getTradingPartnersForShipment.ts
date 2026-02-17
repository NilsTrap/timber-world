"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult, OrganisationOption } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Get Trading Partners for Shipment
 *
 * Returns the list of organisations that can be selected as the "to" destination
 * when shipping from the given organisation. Only returns trading partners.
 *
 * If the organisation has no trading partners configured, returns all active
 * organisations (backwards compatible).
 */
export async function getTradingPartnersForShipment(
  fromOrganisationId: string
): Promise<ActionResult<OrganisationOption[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!UUID_REGEX.test(fromOrganisationId)) {
    return { success: false, error: "Invalid organisation ID", code: "VALIDATION_ERROR" };
  }

  const supabase = await createClient();

  // Get trading partners for this organisation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: partners, error: partnersError } = await (supabase as any)
    .from("organisation_trading_partners")
    .select("partner_organisation_id")
    .eq("organisation_id", fromOrganisationId);

  if (partnersError) {
    console.error("Failed to fetch trading partners:", partnersError);
    return { success: false, error: "Failed to fetch trading partners", code: "QUERY_FAILED" };
  }

  // If no trading partners configured, return empty list
  if (!partners || partners.length === 0) {
    return { success: true, data: [] };
  }

  // Get only the trading partner organisations
  const partnerIds = partners.map((p: { partner_organisation_id: string }) => p.partner_organisation_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: partnerOrgs, error: orgsError } = await (supabase as any)
    .from("organisations")
    .select("id, code, name")
    .eq("is_active", true)
    .in("id", partnerIds)
    .order("code");

  if (orgsError) {
    console.error("Failed to fetch partner organisations:", orgsError);
    return { success: false, error: "Failed to fetch organisations", code: "QUERY_FAILED" };
  }

  return { success: true, data: partnerOrgs as OrganisationOption[] };
}
