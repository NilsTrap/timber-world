/**
 * Deal party-set service (H1) — the pure `(db, actor)` core behind the portal
 * `setDealParties` action, so the MCP deal surface can fill a party-less DRAFT +
 * mint its bilateral code WITHOUT a getSession action. Same walls as the action:
 * draft-only, set-once (then locked), the `resolvePartySlots` trading-partner +
 * trader-binding checks, and the self-deal guard.
 *
 * Trader membership is resolved from the caller's SINGLE org context (a per-user
 * MCP key is bound to one org; the env owner token is `isPlatformAdmin` and skips
 * the wall entirely — both slots are taken verbatim). The activity log is written
 * through the passed `db` (fire-and-forget), so no action-layer helper is needed.
 * The portal action keeps its own copy (it additionally does `revalidatePath` +
 * resolves trader orgs from the full session membership set).
 */
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { ActorContext, DbClient } from "./dealModel";
import { allocateDealCode } from "./orderDeals";
import { resolvePartySlots, getTraderMembershipOrgIds } from "../actions/_validateOrderParty";

export interface SetDealPartiesInput {
  orderId: string;
  customerOrganisationId?: string | null;
  sellerOrganisationId?: string | null;
}

export async function setDealParties(
  db: DbClient,
  actor: ActorContext,
  orgId: string | null,
  input: SetDealPartiesInput,
): Promise<ActionResult<{ dealCode: string | null }>> {
  if (!isValidUUID(input.orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  const client = db as DbClient;

  // Parties are only mutable while Draft, and each slot is set ONCE (then locked):
  // a deal is defined by who sells to whom (§3.1).
  const { data: row, error: loadErr } = await client
    .from("orders")
    .select("lifecycle_stage, deal_code, customer_organisation_id, seller_organisation_id")
    .eq("id", input.orderId)
    .single();
  if (loadErr || !row) return { success: false, error: loadErr?.message ?? "Order not found", code: "NOT_FOUND" };
  if ((row.lifecycle_stage ?? "draft") !== "draft") {
    return { success: false, error: "Parties can only be set while the deal is a draft", code: "NOT_DRAFT" };
  }
  if (row.customer_organisation_id && row.seller_organisation_id) {
    return { success: false, error: "Deal parties are already set and locked (change = cancel + recreate)", code: "ALREADY_SET" };
  }

  // Trader-binding: the env owner token (admin) bypasses the wall; a per-user key
  // is bound to its single org context (the MCP key's org).
  const userTraderOrgIds = actor.isPlatformAdmin ? [] : await getTraderMembershipOrgIds(client, orgId ? [orgId] : []);
  const slots = await resolvePartySlots(
    client,
    { isAdmin: actor.isPlatformAdmin, userOrgId: orgId, userTraderOrgIds },
    { customerOrganisationId: input.customerOrganisationId, sellerOrganisationId: input.sellerOrganisationId },
  );
  if (!slots.ok) return { success: false, error: slots.error, code: slots.code };

  // Only FILL an empty slot — never overwrite an already-set party.
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

  // Mint / RE-mint the bilateral code once both real parties are present. Clear any
  // placeholder first so the code is re-derived from the actual seller/buyer codes;
  // on a re-mint failure, restore the prior code so the draft is never stranded.
  let dealCode: string | null = row.deal_code ?? null;
  if (finalCustomerOrgId && finalSellerOrgId) {
    if (row.deal_code) {
      await client.from("orders").update({ deal_code: null }).eq("id", input.orderId);
    }
    const coded = await allocateDealCode(db, actor, input.orderId);
    if (coded.success) {
      dealCode = coded.data.dealCode;
    } else if (row.deal_code) {
      await client.from("orders").update({ deal_code: row.deal_code }).eq("id", input.orderId);
      dealCode = row.deal_code;
    }
  }

  // Fire-and-forget activity log through the request db (mirrors the portal action's
  // "Parties set"); a logging failure must not fail the write.
  try {
    await client.from("order_activity_log").insert({
      order_id: input.orderId,
      user_id: actor.portalUserId,
      action: "Parties set",
      details: null,
      tab: "list",
    });
  } catch {
    /* non-blocking */
  }

  return { success: true, data: { dealCode } };
}
