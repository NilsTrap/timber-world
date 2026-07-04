"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "../types";
import { getSession } from "@/lib/auth";
import { resolveDealActor } from "./_dealActor";
import { resolvePartySlots, getTraderMembershipOrgIds } from "./_validateOrderParty";
import { allocateDealCode } from "../services/orderDeals";
import { logOrderActivity } from "./logOrderActivity";

/**
 * H1 · Set the Customer (buyer) + Manufacturer (seller) on a DRAFT deal that
 * arrived party-less (portal drafts that predate H1, or MCP-created rows), then
 * mint the bilateral deal code. A deal is defined by who sells to whom (§3.1),
 * so parties are only editable while Draft; changing them after Draft is a
 * cancel + recreate (B2), never an in-place re-point.
 *
 * Permission mirrors createOrder: any orders.view creator (admins bypass), with
 * the same company-role auto-fill + trading-partner walls (resolvePartySlots).
 * The picked counterparty is re-validated server-side — the client is untrusted.
 */
export async function setDealParties(input: {
  orderId: string;
  customerOrganisationId?: string | null;
  sellerOrganisationId?: string | null;
}): Promise<ActionResult<{ dealCode: string | null }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = a.db as any;

  // Load the current state — parties are only mutable while Draft, and each slot
  // is set ONCE (then locked): a deal is defined by who sells to whom (§3.1).
  const { data: row, error: loadErr } = await client
    .from("orders")
    .select("lifecycle_stage, deal_code, customer_organisation_id, seller_organisation_id")
    .eq("id", input.orderId)
    .single();
  if (loadErr || !row) return { success: false, error: loadErr?.message ?? "Order not found", code: "NOT_FOUND" };
  if ((row.lifecycle_stage ?? "draft") !== "draft") {
    return { success: false, error: "Parties can only be set while the deal is a draft", code: "NOT_DRAFT" };
  }
  // Set-once, then immutable (mirror the client card, which only shows on a
  // party-less draft). Enforced server-side so a stale/replayed/direct call can
  // never re-point an already-defined deal under its existing code — a change is
  // cancel + recreate (B2).
  if (row.customer_organisation_id && row.seller_organisation_id) {
    return { success: false, error: "Deal parties are already set and locked (change = cancel + recreate)", code: "ALREADY_SET" };
  }

  // L2 · trader-membership binding (mirrors createOrder). getSession is cached,
  // so this is cheap even though resolveDealActor already read it.
  const session = await getSession();
  const userTraderOrgIds = a.actor.isPlatformAdmin
    ? []
    : await getTraderMembershipOrgIds(client, (session?.memberships ?? []).map((m) => m.organizationId));
  const slots = await resolvePartySlots(
    client,
    { isAdmin: a.actor.isPlatformAdmin, userOrgId: a.orgId, userTraderOrgIds },
    { customerOrganisationId: input.customerOrganisationId, sellerOrganisationId: input.sellerOrganisationId },
  );
  if (!slots.ok) return { success: false, error: slots.error, code: slots.code };

  // Only FILL an empty slot — never overwrite an already-set party. The set slot
  // is the caller's own org (RLS: they can only reach a draft their org is on),
  // so resolvePartySlots may propose their org for a slot that is already taken;
  // the existing value wins.
  const finalCustomerOrgId = row.customer_organisation_id ?? slots.customerOrgId;
  const finalSellerOrgId = row.seller_organisation_id ?? slots.sellerOrgId;
  if (finalCustomerOrgId && finalSellerOrgId && finalCustomerOrgId === finalSellerOrgId) {
    return { success: false, error: "A deal's customer and manufacturer must be different organisations", code: "SELF_DEAL" };
  }

  // Bilateral invariant (E4): buyer mirrors customer (RLS is seller+buyer).
  const { error: upErr } = await client
    .from("orders")
    .update({
      customer_organisation_id: finalCustomerOrgId,
      buyer_organisation_id: finalCustomerOrgId,
      seller_organisation_id: finalSellerOrgId,
    })
    .eq("id", input.orderId);
  if (upErr) return { success: false, error: upErr.message, code: "UPDATE_FAILED" };

  // Mint / RE-mint the bilateral code so it always reflects the now-real parties.
  // We can reach this path only while a slot was still empty, so any pre-existing
  // deal_code is a placeholder — an MCP-created party-less draft already carries a
  // fallback code (createDeal always mints, e.g. TIM-XXX-001), and allocateDealCode
  // short-circuits on any existing code. Clear it first so the code is re-derived
  // from the actual seller/buyer org codes (SELLER-BUYER-NNN); a legacy portal
  // draft has no code and simply mints fresh.
  let dealCode: string | null = row.deal_code ?? null;
  if (finalCustomerOrgId && finalSellerOrgId) {
    if (row.deal_code) {
      await client.from("orders").update({ deal_code: null }).eq("id", input.orderId);
    }
    const coded = await allocateDealCode(a.db, a.actor, input.orderId);
    if (coded.success) {
      dealCode = coded.data.dealCode;
    } else if (row.deal_code) {
      // Re-mint failed (e.g. transient counter error) after clearing — restore the
      // prior code so the draft is never stranded codeless with no recovery UI (the
      // card hides once parties are set). Degrades to the old code, not a lie: the
      // returned + toasted code then matches the DB. Rare; the counter is reliable.
      await client.from("orders").update({ deal_code: row.deal_code }).eq("id", input.orderId);
      dealCode = row.deal_code;
    }
  }

  await logOrderActivity(input.orderId, a.actor.portalUserId, "Parties set", undefined, "list");
  revalidatePath(`/orders/${input.orderId}`);
  return { success: true, data: { dealCode } };
}
