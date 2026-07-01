/**
 * Spine service — the traceable identity that links a chain of bilateral deals
 * (the new "spine" from the Timber spec). Mirrors the orderDeals conventions:
 * functions take `(db, actor, input)` and return `ActionResult`. `db` is the
 * caller-chosen Supabase client; spine WRITES require an admin/service client
 * (RLS restricts spine writes to platform admins). Casts to `any` for the new
 * `spines` / `spine_lineage` tables (generated DB types don't include them yet) —
 * matches the codebase convention.
 */
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { ActorContext, DbClient } from "./dealModel";
import { allocateCounter, buildSpineCode, SPINE_SCOPE } from "./numbering";

export type SpineLifeStage = "spec" | "lot";
export type SpineOrigin = "root" | "split" | "merge";

export interface SpineView {
  id: string;
  code: string; // SP-###
  title: string | null;
  lifeStage: SpineLifeStage;
  status: string; // rolled-up status cache (recomputed from member deals in E4)
  productGroup: string | null;
  origin: SpineOrigin;
  parentSpineId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A deal (order) attached to a spine — the chain view. */
export interface SpineDealRef {
  id: string;
  code: string; // ORD-###
  dealCode: string | null;
  name: string | null;
  status: string;
  sellerOrgId: string | null;
  buyerOrgId: string | null; // today = customer_organisation_id; E2 introduces buyer_organisation_id
}

const SPINE_SELECT =
  "id, code, title, life_stage, status, product_group, origin, parent_spine_id, notes, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSpine(row: any): SpineView {
  return {
    id: row.id,
    code: row.code,
    title: row.title ?? null,
    lifeStage: row.life_stage,
    status: row.status,
    productGroup: row.product_group ?? null,
    origin: row.origin,
    parentSpineId: row.parent_spine_id ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateSpineInput {
  title?: string | null;
  lifeStage?: SpineLifeStage;
  productGroup?: string | null;
  origin?: SpineOrigin;
  parentSpineId?: string | null;
  notes?: string | null;
}

/** Create a spine, atomically allocating the next SP-### code. */
export async function createSpine(
  db: DbClient,
  actor: ActorContext,
  input: CreateSpineInput = {},
): Promise<ActionResult<SpineView>> {
  let code: string;
  try {
    const seq = await allocateCounter(db, SPINE_SCOPE);
    code = buildSpineCode(seq);
  } catch (e) {
    return { success: false, error: (e as Error).message, code: "COUNTER_FAILED" };
  }
  const insert = {
    code,
    title: input.title ?? null,
    life_stage: input.lifeStage ?? "spec",
    product_group: input.productGroup ?? null,
    origin: input.origin ?? "root",
    parent_spine_id: input.parentSpineId ?? null,
    notes: input.notes ?? null,
    created_by: actor.portalUserId,
  };
  const { data: row, error } = await db.from("spines").insert(insert).select(SPINE_SELECT).single();
  if (error || !row) return { success: false, error: error?.message ?? "Failed to create spine", code: "CREATE_FAILED" };
  return { success: true, data: mapSpine(row) };
}

/** Fetch a spine by id. */
export async function getSpine(
  db: DbClient,
  _actor: ActorContext,
  spineId: string,
): Promise<ActionResult<SpineView>> {
  if (!isValidUUID(spineId)) return { success: false, error: "Invalid spine id", code: "VALIDATION_ERROR" };
  const { data: row, error } = await db.from("spines").select(SPINE_SELECT).eq("id", spineId).maybeSingle();
  if (error || !row) return { success: false, error: error?.message ?? "Spine not found", code: "NOT_FOUND" };
  return { success: true, data: mapSpine(row) };
}

/** List the deals attached to a spine, oldest-first (the chain order). */
export async function listSpineDeals(
  db: DbClient,
  _actor: ActorContext,
  spineId: string,
): Promise<ActionResult<SpineDealRef[]>> {
  if (!isValidUUID(spineId)) return { success: false, error: "Invalid spine id", code: "VALIDATION_ERROR" };
  const { data, error } = await db
    .from("orders")
    .select("id, code, deal_code, name, status, seller_organisation_id, customer_organisation_id")
    .eq("spine_id", spineId)
    .order("created_at", { ascending: true });
  if (error) return { success: false, error: error.message, code: "FETCH_FAILED" };
  const refs: SpineDealRef[] = (data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      id: r.id,
      code: r.code,
      dealCode: r.deal_code ?? null,
      name: r.name ?? null,
      status: r.status,
      sellerOrgId: r.seller_organisation_id ?? null,
      buyerOrgId: r.customer_organisation_id ?? null,
    }),
  );
  return { success: true, data: refs };
}

/** Attach an existing deal (order) to a spine. Requires an admin/service client. */
export async function attachDealToSpine(
  db: DbClient,
  _actor: ActorContext,
  orderId: string,
  spineId: string,
): Promise<ActionResult<true>> {
  if (!isValidUUID(orderId) || !isValidUUID(spineId)) {
    return { success: false, error: "Invalid id", code: "VALIDATION_ERROR" };
  }
  const { error } = await db.from("orders").update({ spine_id: spineId }).eq("id", orderId);
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  return { success: true, data: true };
}
