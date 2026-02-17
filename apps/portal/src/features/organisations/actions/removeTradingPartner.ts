"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Remove a trading partner from an organisation
 * Removes the bidirectional relationship
 */
export async function removeTradingPartner(
  organisationId: string,
  partnerOrganisationId: string
): Promise<ActionResult<{ deleted: number }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!isValidUUID(organisationId) || !isValidUUID(partnerOrganisationId)) {
    return { success: false, error: "Invalid organisation ID", code: "VALIDATION_ERROR" };
  }

  const supabase = await createClient();

  // Delete both directions of the relationship
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: error1 } = await (supabase as any)
    .from("organisation_trading_partners")
    .delete()
    .eq("organisation_id", organisationId)
    .eq("partner_organisation_id", partnerOrganisationId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: error2 } = await (supabase as any)
    .from("organisation_trading_partners")
    .delete()
    .eq("organisation_id", partnerOrganisationId)
    .eq("partner_organisation_id", organisationId);

  if (error1 || error2) {
    console.error("Failed to remove trading partner:", error1 || error2);
    return { success: false, error: "Failed to remove trading partner", code: "DELETE_FAILED" };
  }

  return { success: true, data: { deleted: 2 } };
}
