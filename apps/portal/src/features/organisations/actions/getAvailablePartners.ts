"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

interface AvailablePartner {
  id: string;
  code: string;
  name: string;
}

/**
 * Get organisations that are not yet trading partners of the given organisation
 */
export async function getAvailablePartners(
  organisationId: string
): Promise<ActionResult<AvailablePartner[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!isValidUUID(organisationId)) {
    return { success: false, error: "Invalid organisation ID", code: "VALIDATION_ERROR" };
  }

  const supabase = await createClient();

  // Get existing partner IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingPartners, error: partnersError } = await (supabase as any)
    .from("organisation_trading_partners")
    .select("partner_organisation_id")
    .eq("organisation_id", organisationId);

  if (partnersError) {
    console.error("Failed to fetch existing partners:", partnersError);
    return { success: false, error: "Failed to fetch partners", code: "QUERY_FAILED" };
  }

  const existingPartnerIds = (existingPartners || []).map(
    (p: { partner_organisation_id: string }) => p.partner_organisation_id
  );

  // Add the organisation itself to exclusion list
  const excludeIds = [organisationId, ...existingPartnerIds];

  // Get all active organisations except excluded ones
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgs, error: orgsError } = await (supabase as any)
    .from("organisations")
    .select("id, code, name")
    .eq("is_active", true)
    .not("id", "in", `(${excludeIds.join(",")})`)
    .order("code");

  if (orgsError) {
    console.error("Failed to fetch available organisations:", orgsError);
    return { success: false, error: "Failed to fetch organisations", code: "QUERY_FAILED" };
  }

  return { success: true, data: orgs || [] };
}
