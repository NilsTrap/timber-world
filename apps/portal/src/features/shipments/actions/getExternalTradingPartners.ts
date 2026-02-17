"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult, OrganisationOption } from "../types";

/**
 * Get External Trading Partners
 *
 * Returns external trading partners of the current user's organization.
 * These are organizations that can be sources for incoming shipments.
 * Only returns partners that are marked as external (is_external = true).
 */
export async function getExternalTradingPartners(): Promise<
  ActionResult<OrganisationOption[]>
> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!session.organisationId) {
    return { success: false, error: "No organization assigned", code: "NO_ORGANISATION" };
  }

  const supabase = await createClient();

  // Get trading partners that are external
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: partners, error: partnersError } = await (supabase as any)
    .from("organisation_trading_partners")
    .select(`
      partner_organisation_id,
      partner:organisations!partner_organisation_id(id, code, name, is_external, is_active)
    `)
    .eq("organisation_id", session.organisationId);

  if (partnersError) {
    console.error("Failed to fetch trading partners:", partnersError);
    return { success: false, error: "Failed to fetch trading partners", code: "QUERY_FAILED" };
  }

  // Filter to only external and active partners
  const externalPartners: OrganisationOption[] = (partners || [])
    .filter((p: { partner: { is_external: boolean; is_active: boolean } }) =>
      p.partner.is_external && p.partner.is_active
    )
    .map((p: { partner: { id: string; code: string; name: string } }) => ({
      id: p.partner.id,
      code: p.partner.code,
      name: p.partner.name,
    }));

  return { success: true, data: externalPartners };
}
