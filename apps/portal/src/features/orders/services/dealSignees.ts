/**
 * R9 · Per-side signee context for the deal-terms editor — the pure `(db, actor)`
 * read behind the portal `getDealSigneeContext` action, so the MCP deal surface can
 * fetch each party's org + that org's DEFAULT signee (organisations.default_signee_*).
 *
 * The buyer side resolves `buyer_organisation_id ?? customer_organisation_id` — the
 * SAME org the document's buyer card uses (assembleDocumentData). Read through the
 * passed `db` (env owner token = admin; a per-user key is bounded by RLS). The signee
 * name is a non-sensitive commercial term that lands on documents both parties sign.
 */
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { ActorContext, DbClient } from "./dealModel";

export interface DealSigneeParty {
  orgId: string | null;
  orgName: string | null;
  defaultSigneeName: string | null;
  defaultSigneeRole: string | null;
}

async function loadParty(db: DbClient, orgId: string | null): Promise<DealSigneeParty> {
  if (!orgId) return { orgId: null, orgName: null, defaultSigneeName: null, defaultSigneeRole: null };
  const { data } = await db
    .from("organisations")
    .select("id, name, default_signee_name, default_signee_role")
    .eq("id", orgId)
    .maybeSingle();
  return {
    orgId,
    orgName: (data?.name as string | null) ?? null,
    defaultSigneeName: (data?.default_signee_name as string | null) ?? null,
    defaultSigneeRole: (data?.default_signee_role as string | null) ?? null,
  };
}

export async function getDealSigneeContext(
  db: DbClient,
  _actor: ActorContext,
  orderId: string,
): Promise<ActionResult<{ seller: DealSigneeParty; buyer: DealSigneeParty }>> {
  if (!isValidUUID(orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  const { data: row } = await db
    .from("orders")
    .select("seller_organisation_id, customer_organisation_id, buyer_organisation_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!row) return { success: false, error: "Order not found", code: "NOT_FOUND" };

  const sellerOrgId = (row.seller_organisation_id as string | null) ?? null;
  // Mirror assembleDocumentData's sell-side buyer card: bilateral buyer, else the
  // legacy customer slot (customer == buyer invariant until E8).
  const buyerOrgId =
    (row.buyer_organisation_id as string | null) ?? (row.customer_organisation_id as string | null) ?? null;

  const [seller, buyer] = await Promise.all([loadParty(db, sellerOrgId), loadParty(db, buyerOrgId)]);
  return { success: true, data: { seller, buyer } };
}
