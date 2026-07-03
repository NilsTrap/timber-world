"use server";

/**
 * Deal-layer server actions — thin UI callers of the shared orderDeals /
 * orderDocuments services (the twin of the MCP route). Used by the order
 * detail page's Deal tab.
 */
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getAccessProfile } from "@/lib/access";
import type { ActionResult } from "../types";
import type { DealSide, DocType, OrderLineItem } from "../services/dealModel";
import { projectDealView, resolveFieldAccess } from "../services/dealFields";
import { getOrderDeal, updateLineItemAmounts, type OrderDealView, type LineItemAmountPatch } from "../services/orderDeals";
import { generateDocument, getDocumentUrl, deleteDocument, type GeneratedDocument } from "../services/orderDocuments";
import { getSpineBuyLegCost } from "../services/spineSiblings";
import { resolveDealActor } from "./_dealActor";

/** Deal view + whether the current viewer is a platform admin (drives the Deal
 * tab's admin-only edit/delete affordances; the actions re-check server-side).
 *
 * A3 (§5.3): the margin block reads the deal's own lines (sell subtotal) minus the
 * spine-sibling BUY leg's line total (buy subtotal). The buy-side figures are
 * cross-leg cost data — owner/admin ONLY (§9.1) — so they are resolved and
 * attached here behind the admin gate, never derived on the client. */
export type OrderDealViewResult = OrderDealView & {
  viewerIsAdmin: boolean;
  /** Summed line total (cents) of this deal's spine-sibling buy leg(s), for the
   *  owner margin block. null for non-admins OR when no buy leg exists on the spine. */
  siblingBuyLegTotalCents: number | null;
  /** Whether a spine-sibling buy leg exists at all (drives the provisional flag). */
  hasSiblingBuyLeg: boolean;
  /** Whether the sibling buy leg carries any price (else margin stays provisional). */
  siblingBuyLegPriced: boolean;
};

/** Full deal view (header + line items + external refs + documents) for one order. */
export async function getOrderDealView(orderId: string): Promise<ActionResult<OrderDealViewResult>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  const res = await getOrderDeal(a.db, a.actor, orderId);
  if (!res.success) return res as ActionResult<OrderDealViewResult>;
  let view = res.data;
  // E4 field wall: non-admin deal views are projected through the caller's
  // field grants (terms, chain linkage, party identities, buy-side items).
  if (!a.actor.isPlatformAdmin) {
    const session = await getSession();
    const profile = await getAccessProfile(session?.portalUserId ?? null, a.orgId);
    view = projectDealView(view, resolveFieldAccess(profile), a.orgId);
  }
  // A3 (§5.3 / §9.1): resolve the spine-sibling buy-leg cost for the margin block —
  // owner/admin ONLY. Cross-leg cost data must never reach ordinary users, so this
  // stays behind the isPlatformAdmin gate and non-admins receive nulls.
  let siblingBuyLegTotalCents: number | null = null;
  let hasSiblingBuyLeg = false;
  let siblingBuyLegPriced = false;
  if (a.actor.isPlatformAdmin) {
    const buyCost = await getSpineBuyLegCost({
      id: orderId, spineId: view.spineId, dealKind: view.dealKind, seller: view.seller,
    });
    if (buyCost) {
      siblingBuyLegTotalCents = buyCost.totalCents;
      hasSiblingBuyLeg = true;
      siblingBuyLegPriced = buyCost.priced;
    }
  }
  return {
    success: true,
    data: {
      ...view,
      viewerIsAdmin: a.actor.isPlatformAdmin,
      siblingBuyLegTotalCents,
      hasSiblingBuyLeg,
      siblingBuyLegPriced,
    },
  };
}

/** Admin-only: edit price/quantity on a deal's line items (e.g. fill a price the
 * agent left blank). Re-checks admin server-side — never trusts the client. */
export async function updateDealLineItemAmounts(input: { orderId: string; items: LineItemAmountPatch[] }): Promise<ActionResult<OrderLineItem[]>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!a.actor.isPlatformAdmin) return { success: false, error: "Only admins can edit deal amounts", code: "FORBIDDEN" };
  const res = await updateLineItemAmounts(a.db, a.actor, input.orderId, input.items);
  if (res.success) revalidatePath(`/orders/${input.orderId}`);
  return res;
}

/** Admin-only: delete a generated document (file + row). Re-checks admin both
 * here and in the service. `orderId` is only used to revalidate the page. */
export async function deleteOrderDocument(input: { documentId: string; orderId: string }): Promise<ActionResult<{ id: string }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!a.actor.isPlatformAdmin) return { success: false, error: "Only admins can delete documents", code: "FORBIDDEN" };
  const res = await deleteDocument(a.db, a.actor, input.documentId);
  if (res.success) revalidatePath(`/orders/${input.orderId}`);
  return res;
}

/** Generate a document for the deal (interim local renderer), store + return URL. */
export async function generateOrderDocument(input: { orderId: string; docType: DocType; side?: DealSide }): Promise<ActionResult<GeneratedDocument>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  const res = await generateDocument(a.db, a.actor, { orderId: input.orderId, docType: input.docType, side: input.side });
  if (res.success) revalidatePath(`/orders/${input.orderId}`);
  return res;
}

/** Mint a fresh signed download URL for an already-generated document. */
export async function getOrderDocumentUrl(documentId: string): Promise<ActionResult<{ url: string; fileName: string | null }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  return getDocumentUrl(a.db, a.actor, documentId);
}

/**
 * E5 · Owner margin approval (spec §5.3). Toggles orders.margin_approved_at/by.
 * Owner/admin only — automatic minimum-margin rules are deferred (§1.3).
 */
export async function setDealMarginApproval(input: {
  orderId: string;
  approved: boolean;
}): Promise<ActionResult<{ marginApprovedAt: string | null }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!a.actor.isPlatformAdmin) {
    return { success: false, error: "Only the owner can approve the margin", code: "FORBIDDEN" };
  }
  const patch = input.approved
    ? { margin_approved_at: new Date().toISOString(), margin_approved_by: a.actor.portalUserId }
    : { margin_approved_at: null, margin_approved_by: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (a.db as any).from("orders").update(patch).eq("id", input.orderId);
  if (error) return { success: false, error: "Failed to update margin approval", code: "UPDATE_FAILED" };
  revalidatePath(`/orders/${input.orderId}`);
  return { success: true, data: { marginApprovedAt: patch.margin_approved_at } };
}
