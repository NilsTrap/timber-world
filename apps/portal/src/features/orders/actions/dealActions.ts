"use server";

/**
 * Deal-layer server actions — thin UI callers of the shared orderDeals /
 * orderDocuments services (the twin of the MCP route). Used by the order
 * detail page's Deal tab.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../types";
import type { DealSide, DocType } from "../services/dealModel";
import { getOrderDeal, type OrderDealView } from "../services/orderDeals";
import { generateDocument, getDocumentUrl, type GeneratedDocument } from "../services/orderDocuments";
import { resolveDealActor } from "./_dealActor";

/** Full deal view (header + line items + external refs + documents) for one order. */
export async function getOrderDealView(orderId: string): Promise<ActionResult<OrderDealView>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  return getOrderDeal(a.db, a.actor, orderId);
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
