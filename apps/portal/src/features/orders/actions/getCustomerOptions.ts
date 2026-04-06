"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin, orgHasModule } from "@/lib/auth";

interface CustomerOption {
  id: string;
  code: string;
  name: string;
}

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Get Customer Options for Orders
 *
 * Returns organisations available as order customers.
 * - Admins: all active organisations
 * - Non-admin with orders.customer-select: only their trading partners
 */
export async function getCustomerOptions(): Promise<ActionResult<CustomerOption[]>> {
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
      return { success: false, error: "Failed to fetch organisations", code: "QUERY_FAILED" };
    }
    return { success: true, data: data as CustomerOption[] };
  }

  // Non-admin: check module permission
  const userOrgId = session.currentOrganizationId || session.organisationId;
  const canSelect = await orgHasModule(userOrgId, "orders.customer-select");
  if (!canSelect) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  // Fetch trading partners for the user's organisation
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
    return { success: false, error: "Failed to fetch organisations", code: "QUERY_FAILED" };
  }

  return { success: true, data: orgs as CustomerOption[] };
}
