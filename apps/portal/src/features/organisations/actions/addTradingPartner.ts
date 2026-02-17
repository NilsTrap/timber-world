"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * Add a trading partner to an organisation
 * Creates a bidirectional relationship (both orgs can see each other)
 */
export async function addTradingPartner(
  organisationId: string,
  partnerOrganisationId: string
): Promise<ActionResult<{ created: number }>> {
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

  if (organisationId === partnerOrganisationId) {
    return { success: false, error: "Cannot add organisation as its own partner", code: "VALIDATION_ERROR" };
  }

  const supabase = await createClient();

  // Create bidirectional relationship (A can see B, B can see A)
  // Insert first direction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: error1 } = await (supabase as any)
    .from("organisation_trading_partners")
    .insert({
      organisation_id: organisationId,
      partner_organisation_id: partnerOrganisationId,
      created_by: session.id,
    });

  // Ignore duplicate key error (23505)
  if (error1 && error1.code !== "23505") {
    console.error("Failed to add trading partner (direction 1):", error1);
    return { success: false, error: "Failed to add trading partner", code: "INSERT_FAILED" };
  }

  // Insert reverse direction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: error2 } = await (supabase as any)
    .from("organisation_trading_partners")
    .insert({
      organisation_id: partnerOrganisationId,
      partner_organisation_id: organisationId,
      created_by: session.id,
    });

  // Ignore duplicate key error (23505)
  if (error2 && error2.code !== "23505") {
    console.error("Failed to add trading partner (direction 2):", error2);
    return { success: false, error: "Failed to add trading partner", code: "INSERT_FAILED" };
  }

  return { success: true, data: { created: 2 } };
}
