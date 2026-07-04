"use server";

/**
 * R2 (5wywet) · Seller + buyer org addresses used to pre-fill the deal's incoterms
 * place. Each is the org's DEFAULT delivery address if present, else its legal
 * address (mirrors orderDocuments.fetchPartyCard resolution). Gated by the same
 * deal_terms field-wall as the editor — the place is a non-sensitive commercial
 * term that lands on documents both parties sign — and resolved on the admin client
 * so a non-admin deal-terms editor still gets the value.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "../types";
import type { ActionResult } from "../types";
import { resolveDealActor } from "./_dealActor";
import { requireLineWriteAccess } from "./_lineAccess";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

function pick(row: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!row) return null;
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== "") return String(v);
  }
  return null;
}

/** An org's address for the incoterms-place default: its default delivery address
 *  if any, else its legal address. */
async function orgAddress(admin: AnyDb, orgId: string | null): Promise<string | null> {
  if (!orgId) return null;
  // 1) default delivery address (organisation_delivery_addresses)
  try {
    const { data: da } = await admin
      .from("organisation_delivery_addresses")
      .select("address, is_default")
      .eq("organisation_id", orgId)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    const addr = pick(da, ["address"]);
    if (addr) return addr;
  } catch {
    // table may be absent in some environments — fall through to legal address
  }
  // 2) legal address (organisation_details merged over organisations)
  const { data: org } = await admin.from("organisations").select("*").eq("id", orgId).maybeSingle();
  let details: Record<string, unknown> | null = null;
  try {
    const res = await admin.from("organisation_details").select("*").eq("organisation_id", orgId).maybeSingle();
    details = res.data ?? null;
  } catch {
    details = null;
  }
  const merged = { ...(details ?? {}), ...(org ?? {}) } as Record<string, unknown>;
  const parts = [
    pick(merged, ["address", "legal_address", "street"]),
    pick(merged, ["postal_code", "postcode", "zip"]),
    pick(merged, ["city"]),
    pick(merged, ["country"]),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export async function getDealPartyAddresses(
  orderId: string,
): Promise<ActionResult<{ seller: string | null; buyer: string | null }>> {
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
  const buyerOrgId =
    (row.customer_organisation_id as string | null) ?? (row.buyer_organisation_id as string | null) ?? null;
  const [seller, buyer] = await Promise.all([
    orgAddress(admin, row.seller_organisation_id as string | null),
    orgAddress(admin, buyerOrgId),
  ]);
  return { success: true, data: { seller, buyer } };
}
