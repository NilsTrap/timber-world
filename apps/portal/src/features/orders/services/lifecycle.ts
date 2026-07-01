/**
 * Deal lifecycle service (Timber spec §6) — the 5-stage milestone machine plus the
 * configurable GATE engine. Mirrors the orderDeals/spines conventions: pure logic is
 * exported for unit tests; DB functions take `(db, actor, …)` and return ActionResult.
 * `db` is any (generated types don't yet include lifecycle_stage / deal_gates).
 *
 * Stages: Draft → Confirmed → Produced → Loaded → Delivered (+ Cancelled). They are
 * MILESTONES, not mandatory steps. A gate = the requirements to advance FROM a stage;
 * an empty/absent gate auto-advances. Gate config is edited in-app (admin), never code.
 *
 * The authoritative spine ROLLUP lives here (reads orders.lifecycle_stage) rather than
 * in spines.ts, to keep lifecycle→spines a one-way import (no cycle).
 */
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { ActorContext, DbClient } from "./dealModel";

// ── stages ──────────────────────────────────────────────────────────────────
export const LIFECYCLE_STAGES = ["draft", "confirmed", "produced", "loaded", "delivered"] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];
export const CANCELLED_STAGE = "cancelled";

/** Rank of each active stage (cancelled is off-ladder). */
export const LIFECYCLE_RANK: Record<string, number> = {
  draft: 0,
  confirmed: 1,
  produced: 2,
  loaded: 3,
  delivered: 4,
};

/** The next milestone after `stage`, or null at the end / for a terminal stage. */
export function nextStage(stage: string): LifecycleStage | null {
  const i = LIFECYCLE_STAGES.indexOf(stage as LifecycleStage);
  if (i < 0 || i >= LIFECYCLE_STAGES.length - 1) return null;
  return LIFECYCLE_STAGES[i + 1] ?? null;
}

/** A deal can still be cancelled (with chain-break flagging) up to and including Loaded. */
export function isCancellableStage(stage: string): boolean {
  return stage !== CANCELLED_STAGE && stage !== "delivered";
}

// ── gate building blocks (pure) ──────────────────────────────────────────────
export type GateBlock =
  | { type: "party_signoff"; party: "seller" | "buyer" }
  | { type: "acceptance" }
  | { type: "condition"; condition: "payment_recorded" | "document_present"; docType?: string };

export interface GateContext {
  /** keys of recorded confirmations, e.g. "party_signoff:seller", "acceptance:acceptance" */
  confirmations: Set<string>;
  /** external-ref types present on the deal (its "documents") */
  documents: Set<string>;
  /** whether a payment has been recorded on the deal */
  hasPayment: boolean;
}

/** Stable key for a confirmation-backed block (party_signoff / acceptance). */
export function confirmationKey(blockType: string, blockKey: string): string {
  return `${blockType}:${blockKey}`;
}

export function isBlockSatisfied(block: GateBlock, ctx: GateContext): boolean {
  switch (block.type) {
    case "party_signoff":
      return ctx.confirmations.has(confirmationKey("party_signoff", block.party));
    case "acceptance":
      return ctx.confirmations.has(confirmationKey("acceptance", "acceptance"));
    case "condition":
      if (block.condition === "payment_recorded") return ctx.hasPayment;
      // document_present: a specific docType if given, else any document at all
      return block.docType ? ctx.documents.has(block.docType) : ctx.documents.size > 0;
    default:
      return false;
  }
}

export function describeBlock(block: GateBlock): string {
  switch (block.type) {
    case "party_signoff":
      return `${block.party} sign-off`;
    case "acceptance":
      return "buyer acceptance";
    case "condition":
      return block.condition === "payment_recorded"
        ? "payment recorded"
        : `document present${block.docType ? ` (${block.docType})` : ""}`;
    default:
      return "requirement";
  }
}

/** Pure gate evaluation: every required block must be satisfied. Empty gate = satisfied. */
export function evaluateGate(
  requirements: GateBlock[],
  ctx: GateContext,
): { satisfied: boolean; unmet: GateBlock[] } {
  const unmet = (requirements ?? []).filter((b) => !isBlockSatisfied(b, ctx));
  return { satisfied: unmet.length === 0, unmet };
}

// ── spine rollup on the 5-stage vocabulary (pure) ────────────────────────────
/** Least-advanced ACTIVE stage on the spine; empty → draft; all cancelled → cancelled. */
export function rollupSpineStage(stages: string[]): string {
  if (stages.length === 0) return "draft";
  const active = stages.filter((s) => s !== CANCELLED_STAGE);
  if (active.length === 0) return CANCELLED_STAGE;
  let min: string = active[0]!;
  for (const s of active) {
    if ((LIFECYCLE_RANK[s] ?? 0) < (LIFECYCLE_RANK[min] ?? 0)) min = s;
  }
  return min;
}

// ── gate config (DB) ─────────────────────────────────────────────────────────
export interface GateConfigRow {
  id: string;
  dealKind: string;
  fromStage: string;
  requirements: GateBlock[];
  isActive: boolean;
}

function mapGate(row: any): GateConfigRow {
  return {
    id: row.id,
    dealKind: row.deal_kind,
    fromStage: row.from_stage,
    requirements: Array.isArray(row.requirements) ? (row.requirements as GateBlock[]) : [],
    isActive: row.is_active !== false,
  };
}

export async function listGateConfigs(db: DbClient): Promise<ActionResult<GateConfigRow[]>> {
  const { data, error } = await db.from("deal_gates").select("*").order("deal_kind").order("from_stage");
  if (error) return { success: false, error: error.message, code: "LIST_FAILED" };
  return { success: true, data: (data ?? []).map(mapGate) };
}

export async function getGateConfig(
  db: DbClient,
  dealKind: string,
  fromStage: string,
): Promise<ActionResult<GateConfigRow | null>> {
  const { data, error } = await db
    .from("deal_gates")
    .select("*")
    .eq("deal_kind", dealKind)
    .eq("from_stage", fromStage)
    .maybeSingle();
  if (error) return { success: false, error: error.message, code: "GET_FAILED" };
  return { success: true, data: data ? mapGate(data) : null };
}

export interface UpsertGateInput {
  dealKind: string;
  fromStage: string;
  requirements: GateBlock[];
  isActive?: boolean;
}

export async function upsertGateConfig(
  db: DbClient,
  actor: ActorContext,
  input: UpsertGateInput,
): Promise<ActionResult<GateConfigRow>> {
  if (!actor.isPlatformAdmin && !actor.isServiceAgent) {
    return { success: false, error: "Only an admin can configure gates", code: "FORBIDDEN" };
  }
  if (!LIFECYCLE_STAGES.includes(input.fromStage as LifecycleStage) || input.fromStage === "delivered") {
    return { success: false, error: "Invalid from_stage for a gate", code: "VALIDATION_ERROR" };
  }
  // Reject requirement blocks that have no satisfiable data source yet, so an admin can
  // never configure a gate that permanently blocks a deal. `payment_recorded` needs a
  // payment signal Timber doesn't model yet — engine supports it, but it's not offered.
  for (const b of input.requirements ?? []) {
    if (b.type === "condition" && b.condition === "payment_recorded") {
      return { success: false, error: "The 'payment recorded' condition isn't available yet (no payment source is wired)", code: "VALIDATION_ERROR" };
    }
  }
  const { data, error } = await db
    .from("deal_gates")
    .upsert(
      {
        deal_kind: input.dealKind,
        from_stage: input.fromStage,
        requirements: input.requirements ?? [],
        is_active: input.isActive ?? true,
      },
      { onConflict: "deal_kind,from_stage" },
    )
    .select("*")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Upsert failed", code: "UPSERT_FAILED" };
  return { success: true, data: mapGate(data) };
}

// ── per-deal state + gate context (DB) ───────────────────────────────────────
interface DealLifecycle {
  stage: string;
  dealKind: string;
  spineId: string | null;
}

async function getDealLifecycle(db: DbClient, orderId: string): Promise<DealLifecycle | null> {
  const { data } = await db
    .from("orders")
    .select("lifecycle_stage, deal_kind, spine_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!data) return null;
  return {
    stage: (data.lifecycle_stage as string) ?? "draft",
    dealKind: (data.deal_kind as string) ?? "buy_sell",
    spineId: (data.spine_id as string | null) ?? null,
  };
}

/** Reads the confirmations + document facts needed to evaluate a gate. */
export async function buildGateContext(
  db: DbClient,
  orderId: string,
  fromStage: string,
): Promise<GateContext> {
  const confirmations = new Set<string>();
  const documents = new Set<string>();

  // The deal's parties, so a sign-off only counts if the RIGHT party recorded it.
  const { data: order } = await db
    .from("orders")
    .select("seller_organisation_id, buyer_organisation_id")
    .eq("id", orderId)
    .maybeSingle();
  const sellerOrg = (order?.seller_organisation_id as string | null) ?? null;
  const buyerOrg = (order?.buyer_organisation_id as string | null) ?? null;

  const { data: confs } = await db
    .from("deal_gate_confirmations")
    .select("block_type, block_key, confirmed_by_org")
    .eq("order_id", orderId)
    .eq("from_stage", fromStage);
  for (const c of confs ?? []) {
    const blockType = c.block_type as string;
    const blockKey = c.block_key as string;
    const by = (c.confirmed_by_org as string | null) ?? null;
    // which org must have made this confirmation for it to count
    const requiredOrg = blockType === "acceptance" ? buyerOrg : blockKey === "seller" ? sellerOrg : blockKey === "buyer" ? buyerOrg : null;
    // admin confirmations (null org) always count; a party confirmation must match its party
    if (by === null || requiredOrg === null || by === requiredOrg) {
      confirmations.add(confirmationKey(blockType, blockKey));
    }
  }

  // "document present" reads the deal's REAL documents (order_documents.doc_type),
  // e.g. 'invoice' / 'cmr' — not order_external_refs (which only holds client-ref codes).
  const { data: docs } = await db.from("order_documents").select("doc_type").eq("order_id", orderId);
  for (const d of docs ?? []) {
    const t = d.doc_type as string;
    if (t) documents.add(t);
  }

  // payment_recorded has no wired source yet and is rejected at gate-config time, so no
  // gate can depend on it; hasPayment stays false.
  return { confirmations, documents, hasPayment: false };
}

// ── advance / cancel (DB) ────────────────────────────────────────────────────
export interface AdvanceEvaluation {
  currentStage: string;
  nextStage: string | null;
  requirements: GateBlock[];
  satisfied: boolean;
  unmet: GateBlock[];
  willAutoAdvance: boolean;
}

/** Read-only: can this deal advance, and if gated, what's still unmet? */
export async function evaluateAdvance(db: DbClient, orderId: string): Promise<ActionResult<AdvanceEvaluation>> {
  if (!isValidUUID(orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  const deal = await getDealLifecycle(db, orderId);
  if (!deal) return { success: false, error: "Deal not found", code: "NOT_FOUND" };

  const target = nextStage(deal.stage);
  if (deal.stage === CANCELLED_STAGE || target === null) {
    return {
      success: true,
      data: { currentStage: deal.stage, nextStage: null, requirements: [], satisfied: false, unmet: [], willAutoAdvance: false },
    };
  }

  const gateRes = await getGateConfig(db, deal.dealKind, deal.stage);
  if (!gateRes.success) return gateRes as unknown as ActionResult<AdvanceEvaluation>;
  const gate = gateRes.data;
  const requirements = gate && gate.isActive ? gate.requirements : [];

  if (requirements.length === 0) {
    return {
      success: true,
      data: { currentStage: deal.stage, nextStage: target, requirements: [], satisfied: true, unmet: [], willAutoAdvance: true },
    };
  }

  const ctx = await buildGateContext(db, orderId, deal.stage);
  const { satisfied, unmet } = evaluateGate(requirements, ctx);
  return {
    success: true,
    data: { currentStage: deal.stage, nextStage: target, requirements, satisfied, unmet, willAutoAdvance: false },
  };
}

/** Advance a deal one milestone if its gate is satisfied (or empty), then roll up the spine. */
export async function advanceDeal(db: DbClient, actor: ActorContext, orderId: string): Promise<ActionResult<{ stage: string }>> {
  const evalRes = await evaluateAdvance(db, orderId);
  if (!evalRes.success) return evalRes as unknown as ActionResult<{ stage: string }>;
  const ev = evalRes.data;

  if (ev.nextStage === null) {
    return { success: false, error: `Deal is at a terminal stage (${ev.currentStage})`, code: "TERMINAL_STAGE" };
  }
  if (!ev.satisfied) {
    const list = ev.unmet.map(describeBlock).join(", ");
    return { success: false, error: `Gate not satisfied — missing: ${list}`, code: "GATE_BLOCKED" };
  }

  // Only touch the deal; the spine rollup cache is maintained by the DB trigger
  // (trg_orders_spine_cache) so it stays correct even for non-admin operators.
  // Guard on the expected current stage so a concurrent cancel/advance can't be clobbered
  // (and a stale advance can't move the deal backward): 0 rows updated = someone else moved it.
  const { data: updated, error } = await db
    .from("orders")
    .update({ lifecycle_stage: ev.nextStage })
    .eq("id", orderId)
    .eq("lifecycle_stage", ev.currentStage)
    .select("id");
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  if (!updated || updated.length === 0) {
    return { success: false, error: "The deal changed since it was read — reload and try again", code: "STAGE_CONFLICT" };
  }
  return { success: true, data: { stage: ev.nextStage } };
}

/** Record a party sign-off / acceptance confirmation for a deal's current-stage gate. */
export async function recordGateConfirmation(
  db: DbClient,
  actor: ActorContext,
  input: { orderId: string; fromStage: string; blockType: "party_signoff" | "acceptance"; blockKey: string; confirmedByOrg?: string | null },
): Promise<ActionResult<{ recorded: boolean }>> {
  if (!isValidUUID(input.orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  // A non-admin may only sign off for the party they ACTUALLY are on this deal — otherwise
  // a counterparty could forge another party's sign-off. Admins may record on behalf.
  if (!actor.isPlatformAdmin) {
    const { data: order } = await db
      .from("orders")
      .select("seller_organisation_id, buyer_organisation_id")
      .eq("id", input.orderId)
      .maybeSingle();
    const sellerOrg = (order?.seller_organisation_id as string | null) ?? null;
    const buyerOrg = (order?.buyer_organisation_id as string | null) ?? null;
    const requiredOrg = input.blockType === "acceptance" ? buyerOrg : input.blockKey === "seller" ? sellerOrg : input.blockKey === "buyer" ? buyerOrg : null;
    if (!requiredOrg || !input.confirmedByOrg || input.confirmedByOrg !== requiredOrg) {
      return { success: false, error: "You can only sign off for your own party on this deal", code: "FORBIDDEN" };
    }
  }
  const { error } = await db.from("deal_gate_confirmations").upsert(
    {
      order_id: input.orderId,
      from_stage: input.fromStage,
      block_type: input.blockType,
      block_key: input.blockKey,
      confirmed_by_org: input.confirmedByOrg ?? null,
      confirmed_by_user: actor.portalUserId,
    },
    { onConflict: "order_id,from_stage,block_type,block_key" },
  );
  if (error) return { success: false, error: error.message, code: "CONFIRM_FAILED" };
  return { success: true, data: { recorded: true } };
}

/** Cancel a deal. If it was active (≤ Loaded), flag the spine + downstream deals as chain-broken. */
export async function cancelDeal(db: DbClient, actor: ActorContext, orderId: string): Promise<ActionResult<{ stage: string; chainFlagged: boolean }>> {
  if (!isValidUUID(orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  const deal = await getDealLifecycle(db, orderId);
  if (!deal) return { success: false, error: "Deal not found", code: "NOT_FOUND" };
  if (deal.stage === CANCELLED_STAGE) return { success: true, data: { stage: CANCELLED_STAGE, chainFlagged: false } };
  // A delivered (terminal) deal is done — cancelling it would clobber the legacy
  // operational status (completed→cancelled) and the spine rollup. Reject it.
  if (!isCancellableStage(deal.stage)) {
    return { success: false, error: `A ${deal.stage} deal can no longer be cancelled`, code: "NOT_CANCELLABLE" };
  }

  const wasActive = isCancellableStage(deal.stage);
  // Only touch the deal (keep the legacy enum in sync for the operational tabs). The
  // spine rollup + chain_broken flagging (own spine + downstream) is done by the DB
  // trigger trg_orders_spine_cache, so it works regardless of the caller's privilege.
  const { error } = await db
    .from("orders")
    .update({ lifecycle_stage: CANCELLED_STAGE, status: "cancelled" })
    .eq("id", orderId);
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };

  return { success: true, data: { stage: CANCELLED_STAGE, chainFlagged: wasActive && deal.spineId !== null } };
}
