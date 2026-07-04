"use server";

/**
 * R9 (sjfkc3) · Per-side signee context for the deal-terms editor. For each party
 * (seller side / buyer side) it returns the party ORG id + name and that org's
 * DEFAULT signee (organisations.default_signee_*), so the editor can:
 *   • auto-show who will sign when there is no per-deal override, and
 *   • drive the CRM-contact picker (listOrgContacts/createOrgContact on that org).
 *
 * The buyer side resolves buyer_organisation_id ?? customer_organisation_id — the
 * SAME org the document's buyer card uses (assembleDocumentData), so the picker
 * always lists contacts of the org that actually signs. Gated by the same
 * deal_terms field-wall as the editor and resolved on the admin client, so a
 * non-admin deal-terms editor still sees the party defaults (the signee name is a
 * non-sensitive commercial term that lands on documents both parties sign). The
 * CRM contact reads/writes themselves keep their own K1 book-wall.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "../types";
import type { ActionResult } from "../types";
import { resolveDealActor } from "./_dealActor";
import { requireLineWriteAccess } from "./_lineAccess";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/** One side's signee context. Plain shape (not exported — a "use server" file must
 *  not export types) — the editor consumes it structurally via the return type. */
interface DealSigneeParty {
  orgId: string | null;
  orgName: string | null;
  defaultSigneeName: string | null;
  defaultSigneeRole: string | null;
}

async function loadParty(admin: AnyDb, orgId: string | null): Promise<DealSigneeParty> {
  if (!orgId) return { orgId: null, orgName: null, defaultSigneeName: null, defaultSigneeRole: null };
  const { data } = await admin
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
  orderId: string,
): Promise<ActionResult<{ seller: DealSigneeParty; buyer: DealSigneeParty }>> {
  if (!isValidUUID(orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await requireLineWriteAccess(a.actor, a.orgId))) {
    return { success: false, error: "You cannot edit deal terms", code: "FORBIDDEN" };
  }
  const admin = createAdminClient() as AnyDb;
  const { data: row } = await admin
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

  const [seller, buyer] = await Promise.all([
    loadParty(admin, sellerOrgId),
    loadParty(admin, buyerOrgId),
  ]);
  return { success: true, data: { seller, buyer } };
}
