"use server";

/**
 * Deal-layer server actions — thin UI callers of the shared orderDeals /
 * orderDocuments services (the twin of the MCP route). Used by the order
 * detail page's Deal tab.
 */
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getAccessProfile } from "@/lib/access";
import type { AccessProfile } from "@/lib/access/types";
import type { ActionResult } from "../types";
import type { DealSide, DocType, OrderLineItem } from "../services/dealModel";
import { projectDealView, resolveFieldAccess } from "../services/dealFields";
import { getOrderDeal, updateLineItemAmounts, updateDealFields, setMarginApproval, resolveViewerDirection, type OrderDealView, type LineItemAmountPatch } from "../services/orderDeals";
import { logOrderActivity } from "./logOrderActivity";
import { generateDocument, regenerateDocument, getDocumentUrl, deleteDocument, uploadSignedDocument, getSignedDocumentUrl, deleteSignedDocument, type GeneratedDocument } from "../services/orderDocuments";
import { getSpineBuyLegs, getSpineLegs, type SpineLegRef } from "../services/spineSiblings";
import { resolveDealActor } from "./_dealActor";
import { requireLineWriteAccess } from "./_lineAccess";

/** B4: a viewer may start / see sourcing when they can reach the suppliers book —
 *  the walled-book gate (action `counterparty:suppliers` AND module
 *  `counterparties.suppliers`), or platform admin. Mirrors requireBookAccess. */
function hasSuppliersBookAccess(profile: AccessProfile): boolean {
  return profile.actions.has("counterparty:suppliers") && profile.modules.has("counterparties.suppliers");
}

/** Deal view + whether the current viewer is a platform admin (drives the Deal
 * tab's admin-only edit/delete affordances; the actions re-check server-side).
 *
 * A3 (§5.3): the margin block reads the deal's own lines (sell subtotal) minus the
 * spine-sibling BUY leg's line total (buy subtotal). The buy-side figures are
 * cross-leg cost data — owner/admin ONLY (§9.1) — so they are resolved and
 * attached here behind the admin gate, never derived on the client. */
export interface DealSourcingState {
  /** Whether a spine-sibling buy leg already exists. */
  hasBuyLeg: boolean;
  buyLegOrderId: string | null;
  buyLegDealCode: string | null;
  buyLegStage: string | null;
  /** Supplier (= the buy leg's seller); only populated for supplier_identity viewers (§9.2). */
  supplierName: string | null;
}

export type OrderDealViewResult = OrderDealView & {
  viewerIsAdmin: boolean;
  /** Summed line total (cents) of this deal's spine-sibling buy leg(s), for the
   *  owner margin block. null for non-admins OR when no buy leg exists on the spine. */
  siblingBuyLegTotalCents: number | null;
  /** Whether a spine-sibling buy leg exists at all (drives the provisional flag). */
  hasSiblingBuyLeg: boolean;
  /** Whether the sibling buy leg carries any price (else margin stays provisional). */
  siblingBuyLegPriced: boolean;
  /** B5: may this viewer edit line amounts (admin OR deal_terms editable). Drives
   *  the client edit affordances; the action re-checks server-side. */
  canEditDealTerms: boolean;
  /** H1: may this viewer set the deal's parties (admin OR orders.view creator) —
   *  drives the party-less Draft "Set parties" card. setDealParties re-checks. */
  canEditParties: boolean;
  /** B4: may this viewer start / see sourcing (admin OR suppliers-book access). */
  canStartSourcing: boolean;
  /** B4: sourcing state on a SELL deal, for canStartSourcing viewers only (else null). */
  sourcing: DealSourcingState | null;
  /** B3: every leg on the spine for the owner chain card. Empty for non-admins. */
  spineLegs: SpineLegRef[];
  /** C1 (§2.5): the sell/buy framing of this deal FROM THE VIEWER's standpoint,
   *  resolved server-side (the client cannot derive it — it does not know the
   *  viewer's org, and dealKind alone mislabels counterparty logins). */
  viewerDirection: "sell" | "buy";
  /** C1: the counterparty the viewer's leg faces — a customer on a sell deal, a
   *  supplier on a buy deal. Always the viewer's own deal partner, so never walled. */
  facingParty: { role: "customer" | "supplier"; name: string | null };
};

/** Full deal view (header + line items + external refs + documents) for one order. */
export async function getOrderDealView(orderId: string): Promise<ActionResult<OrderDealViewResult>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  const res = await getOrderDeal(a.db, a.actor, orderId);
  if (!res.success) return res as ActionResult<OrderDealViewResult>;
  let view = res.data;
  const isAdmin = a.actor.isPlatformAdmin;
  // RAW spine identity captured BEFORE the field-wall projection nulls `spineId`
  // for viewers without the `chain` grant. The cross-leg resolvers below run on the
  // admin client and are independently owner/sourcing-gated, so the field wall must
  // NOT gate their lookup key — else a suppliers-book non-admin would always see the
  // deal as "unsourced" and could spawn a duplicate buy leg. (projectDealView
  // returns a copy, so res.data stays raw.)
  const rawSpineId = res.data.spineId;
  const rawSeller = res.data.seller;
  const rawBuyer = res.data.buyer;
  const rawDealKind = res.data.dealKind;

  // C1 · direction + facing party, computed from the RAW parties (before the field
  // wall) + the viewer's org. The facing party is the viewer's own transaction
  // partner (seller on a buy, buyer/customer on a sell), which every role is
  // entitled to see (§9.2), so it is safe to source from the raw names.
  const viewerDirection = resolveViewerDirection(rawSeller.id, rawBuyer.id, a.orgId, rawDealKind);
  const facingParty =
    viewerDirection === "sell"
      ? { role: "customer" as const, name: rawBuyer.name }
      : { role: "supplier" as const, name: rawSeller.name };

  // Resolve the viewer's access profile once (non-admins) and reuse it for the
  // field wall + the B4/B5 capability flags. Admins see everything.
  let profile: AccessProfile | null = null;
  if (!isAdmin) {
    const session = await getSession();
    profile = await getAccessProfile(session?.portalUserId ?? null, a.orgId);
    // E4 field wall: project the view through the caller's field grants.
    view = projectDealView(view, resolveFieldAccess(profile), a.orgId);
  }

  const canEditDealTerms = await requireLineWriteAccess(a.actor, a.orgId); // B5 (admin | deal_terms editable)
  const canStartSourcing = isAdmin || (profile ? hasSuppliersBookAccess(profile) : false); // B4
  // H1: setting parties mirrors createOrder's permission (any orders.view creator);
  // admins bypass. profile.modules is the org∩user module set (same as createOrder).
  const canEditParties = isAdmin || (profile ? profile.modules.has("orders.view") : false);
  const seeSupplier = isAdmin || (profile ? resolveFieldAccess(profile).domainVisible("supplier_identity") : false);
  const isBuyLeg = rawDealKind === "purchase_only";

  // Cross-leg resolution (§2.3 spine-resolved) — OWNER/sourcing gated (§9.1/§6.2):
  // margin needs the buy-leg total (admin), sourcing needs the buy-leg ref
  // (canStartSourcing), the chain card needs all legs (admin). Never client-derived.
  let siblingBuyLegTotalCents: number | null = null;
  let hasSiblingBuyLeg = false;
  let siblingBuyLegPriced = false;
  let sourcing: DealSourcingState | null = null;
  let spineLegs: SpineLegRef[] = [];

  if ((isAdmin || canStartSourcing) && !isBuyLeg) {
    const buyLegs = await getSpineBuyLegs({ id: orderId, spineId: rawSpineId, dealKind: rawDealKind, seller: rawSeller });
    if (isAdmin && buyLegs) {
      siblingBuyLegTotalCents = buyLegs.totalCents;
      hasSiblingBuyLeg = true;
      siblingBuyLegPriced = buyLegs.priced;
    }
    if (canStartSourcing) {
      const first = buyLegs?.legs[0] ?? null;
      sourcing = {
        hasBuyLeg: !!buyLegs,
        buyLegOrderId: first?.orderId ?? null,
        buyLegDealCode: first?.dealCode ?? null,
        buyLegStage: first?.lifecycleStage ?? null,
        supplierName: seeSupplier ? (first?.supplierName ?? null) : null,
      };
    }
  }
  if (isAdmin) {
    spineLegs = await getSpineLegs(rawSpineId); // B3 chain card — owner only (raw spine)
  }

  return {
    success: true,
    data: {
      ...view,
      viewerIsAdmin: isAdmin,
      siblingBuyLegTotalCents,
      hasSiblingBuyLeg,
      siblingBuyLegPriced,
      canEditDealTerms,
      canEditParties,
      canStartSourcing,
      sourcing,
      spineLegs,
      viewerDirection,
      facingParty,
    },
  };
}

/**
 * G2 · The editable deal-term fields (§8 merge-field sources). A closed whitelist —
 * dealKind / productGroup / transportBilling are deliberately NOT here, so the
 * terms card can never re-classify a deal.
 */
export interface DealTermsInput {
  incoterms?: string | null;
  incotermsPlace?: string | null;
  advancePct?: number | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  deliveryDeadline?: string | null;
  notes?: string | null;
  /** G3 per-deal signee overrides. */
  sellerSigneeName?: string | null;
  sellerSigneeRole?: string | null;
  buyerSigneeName?: string | null;
  buyerSigneeRole?: string | null;
}

/**
 * G2 · Edit a deal's commercial terms (incoterms, advance, payment/delivery terms,
 * deadline, notes) + per-deal signee overrides from the deal view. Same field-wall
 * gate as B5 (admin OR deal_terms editable); side isolation is RLS's job. The
 * portal previously exposed these read-only (MCP timber_update_deal was the only
 * writer). Logs to the deal's own activity log.
 */
export async function updateDealTerms(input: { orderId: string; terms: DealTermsInput }): Promise<ActionResult<true>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await requireLineWriteAccess(a.actor, a.orgId))) {
    return { success: false, error: "You cannot edit deal terms", code: "FORBIDDEN" };
  }
  const t = input.terms;
  // Whitelist explicitly (never forward dealKind/etc. from the client).
  const patch = {
    incoterms: t.incoterms,
    incotermsPlace: t.incotermsPlace,
    advancePct: t.advancePct,
    paymentTerms: t.paymentTerms,
    deliveryTerms: t.deliveryTerms,
    deliveryDeadline: t.deliveryDeadline,
    notes: t.notes,
    sellerSigneeName: t.sellerSigneeName,
    sellerSigneeRole: t.sellerSigneeRole,
    buyerSigneeName: t.buyerSigneeName,
    buyerSigneeRole: t.buyerSigneeRole,
  };
  const res = await updateDealFields(a.db, a.actor, input.orderId, patch);
  if (res.success) {
    await logOrderActivity(input.orderId, a.actor.portalUserId, "Deal terms updated", undefined, "list");
    revalidatePath(`/orders/${input.orderId}`);
  }
  return res;
}

/** B5: edit price/quantity on a deal's line items. Allowed for platform admins OR
 * actors whose access-group grants `deal_terms` editable (Salesperson / Purchasing).
 * The profile check is side-blind; which DEALS the actor can write is enforced by
 * RLS row visibility (side.sell / side.buy) on the underlying update — so a
 * Purchasing user prices only buy legs, a Salesperson only sell legs. Re-checked
 * server-side; never trusts the client. */
export async function updateDealLineItemAmounts(input: { orderId: string; items: LineItemAmountPatch[] }): Promise<ActionResult<OrderLineItem[]>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await requireLineWriteAccess(a.actor, a.orgId))) {
    return { success: false, error: "You cannot edit deal amounts", code: "FORBIDDEN" };
  }
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

/**
 * D1 (§8.2) · Firm a quotation into the order specification — regenerate the spec
 * PDF in place (same row + number), flipping doc_state to 'firm'. A house action:
 * platform admin OR a deal_terms-editable user (Salesperson on the sell deal); a
 * client-login "accept" can drive this later (§9.2). Re-checked server-side.
 */
export async function firmOrderSpecification(input: { orderId: string; documentId: string }): Promise<ActionResult<GeneratedDocument>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await requireLineWriteAccess(a.actor, a.orgId))) {
    return { success: false, error: "You cannot firm this specification", code: "FORBIDDEN" };
  }
  const res = await regenerateDocument(a.db, a.actor, { documentId: input.documentId, docState: "firm" });
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
 * N2 (b) · Upload (or replace) the counterparty-signed version of a generated
 * document. House action — admin OR a deal_terms-editable user (Salesperson /
 * Purchasing). The signed PDF arrives as FormData (`file`). Re-checked server-side.
 */
const MAX_SIGNED_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
export async function uploadSignedOrderDocument(input: { documentId: string; orderId: string; formData: FormData }): Promise<ActionResult<{ id: string; url: string | null }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await requireLineWriteAccess(a.actor, a.orgId))) {
    return { success: false, error: "You cannot upload a signed version", code: "FORBIDDEN" };
  }
  const file = input.formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided", code: "NO_FILE" };
  if (file.size > MAX_SIGNED_FILE_SIZE) return { success: false, error: "File too large. Maximum size: 100MB", code: "FILE_TOO_LARGE" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const res = await uploadSignedDocument(a.db, a.actor, {
    documentId: input.documentId,
    bytes,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
  });
  if (res.success) {
    await logOrderActivity(input.orderId, a.actor.portalUserId, "Signed document uploaded", undefined, "list");
    revalidatePath(`/orders/${input.orderId}`);
  }
  return res;
}

/** N2 (b) · Mint a signed download URL for a document's uploaded signed version. */
export async function getSignedOrderDocumentUrl(documentId: string): Promise<ActionResult<{ url: string; fileName: string | null }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  return getSignedDocumentUrl(a.db, a.actor, documentId);
}

/** N2 (b) · Delete a document's uploaded signed version (file + signed_* columns).
 *  Same house gate as upload; re-checked server-side. Confirmed in the UI. */
export async function deleteSignedOrderDocument(input: { documentId: string; orderId: string }): Promise<ActionResult<{ id: string }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await requireLineWriteAccess(a.actor, a.orgId))) {
    return { success: false, error: "You cannot delete the signed version", code: "FORBIDDEN" };
  }
  const res = await deleteSignedDocument(a.db, a.actor, input.documentId);
  if (res.success) {
    await logOrderActivity(input.orderId, a.actor.portalUserId, "Signed document removed", undefined, "list");
    revalidatePath(`/orders/${input.orderId}`);
  }
  return res;
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
  // Owner guard + the orders.update now live in the shared setMarginApproval
  // service (twin caller = the MCP route); the action keeps session + cache.
  const res = await setMarginApproval(a.db, a.actor, input.orderId, input.approved);
  if (res.success) revalidatePath(`/orders/${input.orderId}`);
  return res;
}
