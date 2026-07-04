"use server";

/**
 * L1 · Spine-Lego "leg" actions — the portal surface of §1's New-order UX.
 *
 * A LEG is a new deal that attaches to an EXISTING deal's spine and copies that
 * origin's spec lines (product definition + catalog links + quantities; prices
 * blank — each leg prices itself). Nils, as admin, assembles chains manually, so
 * these actions are ADMIN-ONLY (the dialog mode choice + "Create next leg" are
 * admin-only too). Salespeople only ever create blank deals for their own trader.
 */
import { revalidatePath } from "next/cache";
import type { ActionResult } from "../types";
import { resolveDealActor } from "./_dealActor";
import { createDeal, duplicateDeal, getOrderDeal, listDeals } from "../services/orderDeals";
import { logOrderActivity } from "./logOrderActivity";

export interface OriginDealOption {
  id: string;
  /** Nils-convention deal code (SELLER-BUYER-NNN) or null if not yet minted. */
  dealCode: string | null;
  /** Legacy ORD-### code (always present) — a fallback label. */
  code: string;
  /** Buyer (customer) name, for the dropdown label. */
  buyerName: string | null;
  /** R5 · Seller (trader) name, for the copy-from-existing picker label. */
  sellerName: string | null;
  /** Spine code (SP-###) or null if the origin has no spine yet (minted on use). */
  spineCode: string | null;
}

/**
 * The existing deals an admin may fork a new leg from (dropdown source). Shows
 * deal code / buyer / spine code per the spec. Admin-only — the whole leg
 * mechanic is hidden from salespeople.
 */
export async function getOriginDealOptions(): Promise<ActionResult<OriginDealOption[]>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!a.actor.isPlatformAdmin) return { success: false, error: "Admins only", code: "FORBIDDEN" };

  const res = await listDeals(a.db, a.actor, { limit: 200 });
  if (!res.success) return { success: false, error: res.error, code: res.code };

  // Resolve spine codes for the deals that carry a spine.
  const spineIds = Array.from(new Set(res.data.map((d) => d.spineId).filter((v): v is string => !!v)));
  const spineCodeById = new Map<string, string>();
  if (spineIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: spines } = await (a.db as any).from("spines").select("id, code").in("id", spineIds);
    for (const s of (spines ?? []) as { id: string; code: string }[]) spineCodeById.set(s.id, s.code);
  }

  const options: OriginDealOption[] = res.data
    .filter((d) => d.lifecycleStage !== "cancelled")
    .map((d) => ({
      id: d.id,
      dealCode: d.dealCode,
      code: d.code,
      buyerName: d.buyer.name ?? d.customer.name ?? null,
      sellerName: d.seller.name ?? null,
      spineCode: d.spineId ? spineCodeById.get(d.spineId) ?? null : null,
    }));

  return { success: true, data: options };
}

/**
 * Create a new leg on an origin deal's spine, copying the origin's spec lines
 * (prices blank). ADMIN-ONLY. The origin mints its spine now if it lacks one
 * (createDeal). Parties are the admin's free choice (customer = buyer,
 * seller = the trader); either may be left null (L3 — a leg may be held with one
 * party unset while shopping).
 */
export async function createDealLegAction(input: {
  originDealId: string;
  customerOrganisationId?: string | null;
  sellerOrganisationId?: string | null;
  name?: string | null;
  copyLines?: boolean;
}): Promise<ActionResult<{ id: string; dealCode: string | null }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!a.actor.isPlatformAdmin) return { success: false, error: "Admins only", code: "FORBIDDEN" };

  const res = await createDeal(a.db, a.actor, {
    originDealId: input.originDealId,
    copyLines: input.copyLines ?? true,
    name: input.name ?? null,
    customerOrganisationId: input.customerOrganisationId ?? null,
    sellerOrganisationId: input.sellerOrganisationId ?? null,
  });
  if (!res.success) return { success: false, error: res.error, code: res.code };

  revalidatePath(`/orders/${res.data.id}`);
  revalidatePath(`/orders/${input.originDealId}`);
  return { success: true, data: { id: res.data.id, dealCode: res.data.dealCode } };
}

/**
 * R5 · "Copy from existing order" — duplicate a deal into a NEW ORIGIN (fresh spine
 * + own code, Draft), copying parties, currency, all terms and the spec lines WITH
 * their prices. ADMIN-ONLY, mirroring createDealLegAction: duplicating an arbitrary
 * deal copies its parties + prices verbatim (a wall-leak risk for salespeople), and
 * the source picker (getOriginDealOptions) is already admin-only. Extending this to
 * salespeople-own-trader is a deliberate follow-up. Logs "Duplicated from <code>" on
 * the new deal via logOrderActivity.
 */
export async function duplicateDealAction(input: { sourceDealId: string }): Promise<ActionResult<{ id: string; dealCode: string | null }>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!a.actor.isPlatformAdmin) return { success: false, error: "Admins only", code: "FORBIDDEN" };

  // Resolve the source code first for the activity note (also validates access).
  const srcRes = await getOrderDeal(a.db, a.actor, input.sourceDealId);
  if (!srcRes.success) return { success: false, error: srcRes.error, code: srcRes.code };

  const res = await duplicateDeal(a.db, a.actor, input.sourceDealId);
  if (!res.success) return { success: false, error: res.error, code: res.code };

  await logOrderActivity(
    res.data.id,
    a.actor.portalUserId,
    "Deal duplicated",
    `Duplicated from ${srcRes.data.dealCode ?? srcRes.data.code}`,
    "list",
  );
  revalidatePath(`/orders/${res.data.id}`);
  return { success: true, data: { id: res.data.id, dealCode: res.data.dealCode } };
}
