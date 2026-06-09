"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

interface PartyOption {
  id: string;
  code: string;
  name: string;
}

export interface OrderPartyOptions {
  userOrgId: string | null;
  userOrgName: string | null;
  userIsManufacturer: boolean;
  customerOptions: PartyOption[];
  manufacturerOptions: PartyOption[];
  producerOptions: PartyOption[];
}

/**
 * Get Order Party Options (role-aware)
 *
 * Returns the organisations a user may assign to an order's Customer / Manufacturer
 * (seller) slots, plus their own org info so the UI can decide which slot is
 * auto-filled and which is picked.
 *
 * - Admins: customerOptions = all active is_customer orgs; manufacturerOptions =
 *   all active is_manufacturer orgs.
 * - Non-admins: options are drawn from the user's trading partners, filtered by
 *   role + active. The user's own org fills the opposite slot (handled server-side
 *   on create), so it is intentionally not included in the pick lists.
 */
export async function getOrderPartyOptions(): Promise<ActionResult<OrderPartyOptions>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const userOrgId = session.currentOrganizationId || session.organisationId;

  // Resolve the user's own org (name + manufacturer flag)
  let userOrgName: string | null = null;
  let userIsManufacturer = false;
  if (userOrgId) {
    const { data: ownOrg } = await client
      .from("organisations")
      .select("id, name, is_manufacturer")
      .eq("id", userOrgId)
      .single();
    if (ownOrg) {
      userOrgName = (ownOrg.name as string) ?? null;
      userIsManufacturer = ownOrg.is_manufacturer === true;
    }
  }

  // Admins: all active role-flagged orgs
  if (isAdmin(session)) {
    const { data: customerOrgs, error: customerErr } = await client
      .from("organisations")
      .select("id, code, name")
      .eq("is_active", true)
      .eq("is_customer", true)
      .order("code");
    if (customerErr) {
      return { success: false, error: "Failed to fetch customer organisations", code: "QUERY_FAILED" };
    }

    const { data: manufacturerOrgs, error: manufacturerErr } = await client
      .from("organisations")
      .select("id, code, name")
      .eq("is_active", true)
      .eq("is_manufacturer", true)
      .order("code");
    if (manufacturerErr) {
      return { success: false, error: "Failed to fetch manufacturer organisations", code: "QUERY_FAILED" };
    }

    const { data: producerOrgs, error: producerErr } = await client
      .from("organisations")
      .select("id, code, name")
      .eq("is_active", true)
      .eq("is_producer", true)
      .order("code");
    if (producerErr) {
      return { success: false, error: "Failed to fetch producer organisations", code: "QUERY_FAILED" };
    }

    return {
      success: true,
      data: {
        userOrgId,
        userOrgName,
        userIsManufacturer,
        customerOptions: (customerOrgs ?? []) as PartyOption[],
        manufacturerOptions: (manufacturerOrgs ?? []) as PartyOption[],
        producerOptions: (producerOrgs ?? []) as PartyOption[],
      },
    };
  }

  // Non-admin: options come from the user's trading partners only
  const { data: partners, error: partnersError } = await client
    .from("organisation_trading_partners")
    .select("partner_organisation_id")
    .eq("organisation_id", userOrgId);

  if (partnersError) {
    return { success: false, error: "Failed to fetch trading partners", code: "QUERY_FAILED" };
  }

  if (!partners || partners.length === 0) {
    return {
      success: true,
      data: {
        userOrgId,
        userOrgName,
        userIsManufacturer,
        customerOptions: [],
        manufacturerOptions: [],
        producerOptions: [],
      },
    };
  }

  const partnerIds = partners.map(
    (p: { partner_organisation_id: string }) => p.partner_organisation_id
  );

  const { data: partnerOrgs, error: orgsError } = await client
    .from("organisations")
    .select("id, code, name, is_customer, is_manufacturer, is_producer, is_active")
    .in("id", partnerIds)
    .eq("is_active", true)
    .order("code");

  if (orgsError) {
    return { success: false, error: "Failed to fetch organisations", code: "QUERY_FAILED" };
  }

  type PartnerOrgRow = PartyOption & { is_customer: boolean; is_manufacturer: boolean; is_producer: boolean; is_active: boolean };
  const rows = (partnerOrgs ?? []) as PartnerOrgRow[];

  const toOption = (o: PartnerOrgRow): PartyOption => ({ id: o.id, code: o.code, name: o.name });

  const customerOptions = rows.filter((o) => o.is_customer === true).map(toOption);
  const manufacturerOptions = rows.filter((o) => o.is_manufacturer === true).map(toOption);
  const producerOptions = rows.filter((o) => o.is_producer === true).map(toOption);

  return {
    success: true,
    data: {
      userOrgId,
      userOrgName,
      userIsManufacturer,
      customerOptions,
      manufacturerOptions,
      producerOptions,
    },
  };
}
