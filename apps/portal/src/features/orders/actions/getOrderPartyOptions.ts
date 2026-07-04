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
  /** Whether the caller is a platform admin — admins pick BOTH slots freely; a
   *  non-admin has one slot bound by their org role / trader membership. */
  isAdmin: boolean;
  userOrgId: string | null;
  userOrgName: string | null;
  /** Legacy seller-side signal (current org is_manufacturer). Kept for the
   *  OrdersTable inline party editor; the New-deal dialog uses userIsTrader. */
  userIsManufacturer: boolean;
  /** L2 · the caller is bound to at least one trader org (a salesperson). */
  userIsTrader: boolean;
  customerOptions: PartyOption[];
  /** Legacy seller pick list (is_manufacturer). Kept for OrdersTable. */
  manufacturerOptions: PartyOption[];
  /** L2 · the "Trader" (seller) pick list — admins: all is_trader orgs; a
   *  salesperson: their own trader orgs; customer-side: is_trader partners. */
  traderOptions: PartyOption[];
  /** L2 · the caller's own trader-org memberships (drives auto-select when one). */
  userTraderOrgs: PartyOption[];
  producerOptions: PartyOption[];
}

/**
 * Get Order Party Options (role-aware)
 *
 * Returns the organisations a user may assign to an order's Customer / Trader
 * (seller) slots, plus their own org + trader-membership info so the UI can
 * decide which slot is auto-filled and which is picked.
 *
 * - Admins: customerOptions = all active is_customer orgs; traderOptions = all
 *   active is_trader orgs.
 * - Salesperson (bound to trader org[s]): traderOptions = their own trader orgs
 *   (auto-selected when exactly one); customerOptions from their trading partners.
 * - Customer-side non-admin: options are trading partners filtered by role; the
 *   user's own org fills the Customer slot (server-side on create).
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

  // L2 · the user's trader-org memberships — the house companies a salesperson
  // may sell from (auto-selected when exactly one).
  const membershipOrgIds = session.memberships.map((m) => m.organizationId).filter(Boolean);
  let userTraderOrgs: PartyOption[] = [];
  if (!isAdmin(session) && membershipOrgIds.length > 0) {
    const { data: traderMemberOrgs } = await client
      .from("organisations")
      .select("id, code, name")
      .in("id", membershipOrgIds)
      .eq("is_trader", true)
      .eq("is_active", true)
      .order("code");
    userTraderOrgs = (traderMemberOrgs ?? []) as PartyOption[];
  }
  const userIsTrader = userTraderOrgs.length > 0;

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

    const { data: traderOrgs, error: traderErr } = await client
      .from("organisations")
      .select("id, code, name")
      .eq("is_active", true)
      .eq("is_trader", true)
      .order("code");
    if (traderErr) {
      return { success: false, error: "Failed to fetch trader organisations", code: "QUERY_FAILED" };
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
        isAdmin: true,
        userOrgId,
        userOrgName,
        userIsManufacturer,
        userIsTrader: false,
        customerOptions: (customerOrgs ?? []) as PartyOption[],
        manufacturerOptions: (manufacturerOrgs ?? []) as PartyOption[],
        traderOptions: (traderOrgs ?? []) as PartyOption[],
        userTraderOrgs: [],
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
        isAdmin: false,
        userOrgId,
        userOrgName,
        userIsManufacturer,
        userIsTrader,
        customerOptions: [],
        manufacturerOptions: [],
        // A salesperson still sells from their own trader org(s) even with no
        // trading partners loaded (their Customer book may just be empty).
        traderOptions: userIsTrader ? userTraderOrgs : [],
        userTraderOrgs,
        producerOptions: [],
      },
    };
  }

  const partnerIds = partners.map(
    (p: { partner_organisation_id: string }) => p.partner_organisation_id
  );

  const { data: partnerOrgs, error: orgsError } = await client
    .from("organisations")
    .select("id, code, name, is_customer, is_manufacturer, is_producer, is_trader, is_active")
    .in("id", partnerIds)
    .eq("is_active", true)
    .order("code");

  if (orgsError) {
    return { success: false, error: "Failed to fetch organisations", code: "QUERY_FAILED" };
  }

  type PartnerOrgRow = PartyOption & { is_customer: boolean; is_manufacturer: boolean; is_producer: boolean; is_trader: boolean; is_active: boolean };
  const rows = (partnerOrgs ?? []) as PartnerOrgRow[];

  const toOption = (o: PartnerOrgRow): PartyOption => ({ id: o.id, code: o.code, name: o.name });

  const customerOptions = rows.filter((o) => o.is_customer === true).map(toOption);
  const manufacturerOptions = rows.filter((o) => o.is_manufacturer === true).map(toOption);
  const producerOptions = rows.filter((o) => o.is_producer === true).map(toOption);
  // A salesperson sells from their OWN trader orgs; a customer-side user picks a
  // trader from their is_trader trading partners.
  const traderOptions = userIsTrader ? userTraderOrgs : rows.filter((o) => o.is_trader === true).map(toOption);

  return {
    success: true,
    data: {
      isAdmin: false,
      userOrgId,
      userOrgName,
      userIsManufacturer,
      userIsTrader,
      customerOptions,
      manufacturerOptions,
      traderOptions,
      userTraderOrgs,
      producerOptions,
    },
  };
}
