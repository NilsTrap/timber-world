"use server";

/**
 * Sourcing server actions (Epic B) — the portal surface of the spec's §9.3/§10
 * sourcing flow. B1 "Start sourcing" spawns the buy leg for an existing sell deal;
 * B2 "Replace supplier" cancels the current buy leg and respawns a fresh one.
 *
 * Permission model: a caller may source when they can reach the SUPPLIERS book —
 * the walled-book gate (action `counterparty:suppliers` AND module
 * `counterparties.suppliers`), or platform admin. RLS additionally limits which
 * sell deals they can even load.
 */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessProfile } from "@/lib/access";
import type { ActionResult } from "../types";
import type { ActorContext } from "../services/dealModel";
import { startSourcing, getOrderDeal } from "../services/orderDeals";
import { LIFECYCLE_RANK } from "../services/lifecycle";
import { getSpineBuyLegs } from "../services/spineSiblings";
import { listCounterparties } from "@/features/counterparties/actions/counterparties";
import { resolveDealActor } from "./_dealActor";

export interface SupplierOption {
  id: string;
  code: string;
  name: string;
}

export interface SourcingResult {
  buyLegOrderId: string;
  buyLegDealCode: string | null;
}

/** The suppliers book (is_supplier OR is_producer) for the picker. Reuses the
 *  walled-book listing — already gated on `counterparty:suppliers` + the module. */
export async function getSupplierOptions(): Promise<ActionResult<SupplierOption[]>> {
  const res = await listCounterparties("suppliers");
  if (!res.success) return { success: false, error: res.error, code: res.code };
  return { success: true, data: res.data.map((r) => ({ id: r.id, code: r.code, name: r.name })) };
}

/** May this actor source? Admin, or holds the suppliers-book walled gate. */
async function canSource(actor: ActorContext, orgId: string | null): Promise<boolean> {
  if (actor.isPlatformAdmin) return true;
  const p = await getAccessProfile(actor.portalUserId, orgId);
  return p.actions.has("counterparty:suppliers") && p.modules.has("counterparties.suppliers");
}

/** The picked org must be an active supplier or producer (never trust the client id). */
async function isActiveSupplierOrg(orgId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("organisations")
    .select("is_supplier, is_producer, is_active")
    .eq("id", orgId)
    .maybeSingle();
  return !!data && data.is_active !== false && (data.is_supplier === true || data.is_producer === true);
}

/** L1 · the editable BUY-leg buyer must be an active trader (never trust the client). */
async function isActiveTraderOrg(orgId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("organisations")
    .select("is_trader, is_active")
    .eq("id", orgId)
    .maybeSingle();
  return !!data && data.is_active !== false && data.is_trader === true;
}

/** B1/L1 — Create the next (buy) leg for an existing sell deal: spawn a buy leg
 *  (supplier → buyer) on the same spine, with the sell lines copied (prices
 *  blank). The buyer defaults to this deal's seller but is editable (L1 fixes the
 *  Meeting-1 wrong-buyer bug); a provided buyer is re-validated as an active
 *  trader. */
export async function startSourcingAction(input: { orderId: string; supplierOrgId: string; buyerOrgId?: string | null }): Promise<ActionResult<SourcingResult>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await canSource(a.actor, a.orgId))) {
    return { success: false, error: "You need suppliers-book access to start sourcing", code: "FORBIDDEN" };
  }
  if (!(await isActiveSupplierOrg(input.supplierOrgId))) {
    return { success: false, error: "That organisation is not an active supplier or producer", code: "VALIDATION_ERROR" };
  }
  if (input.buyerOrgId && !(await isActiveTraderOrg(input.buyerOrgId))) {
    return { success: false, error: "The buyer must be an active trader", code: "VALIDATION_ERROR" };
  }
  const res = await startSourcing(a.db, a.actor, input.orderId, input.supplierOrgId, input.buyerOrgId ?? null);
  if (!res.success) return { success: false, error: res.error, code: res.code };
  revalidatePath(`/orders/${input.orderId}`);
  return { success: true, data: { buyLegOrderId: res.data.id, buyLegDealCode: res.data.dealCode } };
}

/** B2 — Replace the supplier: cancel the current buy leg (only while ≤ Confirmed)
 *  and respawn via B1. Never re-points a deal's seller (§3.1 — deal codes are
 *  directional identities). The cancel flags the spine (§6.4); we clear that flag
 *  after the respawn re-establishes the chain. */
export async function replaceSupplierAction(input: { orderId: string; newSupplierOrgId: string; buyerOrgId?: string | null }): Promise<ActionResult<SourcingResult>> {
  const a = await resolveDealActor();
  if (!a.ok) return { success: false, error: a.error, code: a.code };
  if (!(await canSource(a.actor, a.orgId))) {
    return { success: false, error: "You need suppliers-book access to replace a supplier", code: "FORBIDDEN" };
  }
  if (!(await isActiveSupplierOrg(input.newSupplierOrgId))) {
    return { success: false, error: "That organisation is not an active supplier or producer", code: "VALIDATION_ERROR" };
  }
  if (input.buyerOrgId && !(await isActiveTraderOrg(input.buyerOrgId))) {
    return { success: false, error: "The buyer must be an active trader", code: "VALIDATION_ERROR" };
  }

  const dealRes = await getOrderDeal(a.db, a.actor, input.orderId);
  if (!dealRes.success) return { success: false, error: dealRes.error, code: dealRes.code };
  const sellDeal = dealRes.data;

  const buyLegs = await getSpineBuyLegs({ id: input.orderId, spineId: sellDeal.spineId, dealKind: sellDeal.dealKind, seller: sellDeal.seller });
  const activeLegs = buyLegs?.legs ?? [];
  if (activeLegs.length === 0) {
    return { success: false, error: "No active sourcing deal to replace — use Start sourcing", code: "NOT_FOUND" };
  }
  if (activeLegs.length > 1) {
    return { success: false, error: "This deal has multiple active sourcing deals — resolve those before replacing", code: "CONFLICT" };
  }
  const existing = activeLegs[0];
  if (!existing) {
    return { success: false, error: "No active sourcing deal to replace — use Start sourcing", code: "NOT_FOUND" };
  }
  // Fast pre-check for a clear message; the authoritative bound is enforced
  // atomically at cancel time below (≤ Confirmed only — replacing after production
  // would strand produced goods).
  const rank = existing.lifecycleStage != null ? LIFECYCLE_RANK[existing.lifecycleStage] : undefined;
  if (rank == null || rank > 1) {
    return { success: false, error: "The sourcing deal is past Confirmed — it can't be replaced (cancel it manually if needed)", code: "CONFLICT" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // ATOMIC conditional cancel: cancel the old leg ONLY if it is STILL ≤ Confirmed.
  // The `.in(lifecycle_stage, …)` predicate closes the TOCTOU window against a
  // concurrent advance to produced/loaded (0 rows updated ⇒ it advanced ⇒ abort).
  // Cancelling trips the spine chain-broken flag via the DB trigger (§6.4).
  const { data: cancelledRows, error: cancelErr } = await admin
    .from("orders")
    .update({ lifecycle_stage: "cancelled", status: "cancelled" })
    .eq("id", existing.orderId)
    .in("lifecycle_stage", ["draft", "confirmed"])
    .select("id");
  if (cancelErr) return { success: false, error: cancelErr.message, code: "UPDATE_FAILED" };
  if (!cancelledRows || cancelledRows.length === 0) {
    return { success: false, error: "The sourcing deal advanced past Confirmed — it can no longer be replaced", code: "CONFLICT" };
  }

  // Respawn with the new supplier (fresh buy leg on the same spine, lines re-copied).
  const res = await startSourcing(a.db, a.actor, input.orderId, input.newSupplierOrgId, input.buyerOrgId ?? null);
  if (!res.success) {
    // COMPENSATE: cancel + respawn are not one transaction. On respawn failure,
    // un-cancel the old leg and clear the chain_broken the cancel set, so the deal
    // is left consistent (still sourced from the original supplier).
    await admin.from("orders")
      .update({ lifecycle_stage: existing.lifecycleStage, status: existing.lifecycleStage })
      .eq("id", existing.orderId);
    if (sellDeal.spineId) await admin.from("spines").update({ chain_broken: false }).eq("id", sellDeal.spineId);
    return { success: false, error: res.error, code: res.code };
  }

  // Success — the respawn re-established the chain; clear the chain_broken flag.
  if (sellDeal.spineId) await admin.from("spines").update({ chain_broken: false }).eq("id", sellDeal.spineId);

  revalidatePath(`/orders/${input.orderId}`);
  return { success: true, data: { buyLegOrderId: res.data.id, buyLegDealCode: res.data.dealCode } };
}
