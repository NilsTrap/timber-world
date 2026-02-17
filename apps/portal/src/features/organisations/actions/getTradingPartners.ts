"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult, TradingPartner } from "../types";
import { isValidUUID } from "../types";

/**
 * Get all trading partners for an organisation
 */
export async function getTradingPartners(
  organisationId: string
): Promise<ActionResult<TradingPartner[]>> {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organisation_trading_partners")
    .select(`
      id,
      partner_organisation_id,
      created_at,
      partner:organisations!partner_organisation_id(id, code, name)
    `)
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch trading partners:", error);
    return { success: false, error: "Failed to fetch trading partners", code: "QUERY_FAILED" };
  }

  const partners: TradingPartner[] = (data || []).map((row: {
    id: string;
    partner_organisation_id: string;
    created_at: string;
    partner: { id: string; code: string; name: string };
  }) => ({
    id: row.id,
    partnerId: row.partner_organisation_id,
    partnerCode: row.partner.code,
    partnerName: row.partner.name,
    createdAt: row.created_at,
  }));

  return { success: true, data: partners };
}
