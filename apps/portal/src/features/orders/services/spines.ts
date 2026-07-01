/**
 * Spine service — the traceable identity that links a chain of bilateral deals
 * (the new "spine" from the Timber spec). Mirrors the orderDeals conventions:
 * functions take `(db, actor, input)` and return `ActionResult`. `db` is the
 * caller-chosen Supabase client; spine WRITES require an admin/service client
 * (RLS restricts spine writes to platform admins). Casts to `any` for the new
 * `spines` / `spine_lineage` tables (generated DB types don't include them yet) —
 * matches the codebase convention.
 *
 * The shared PRODUCT DEFINITION (species/type/finish/certificate/dims/pieces/volume)
 * lives on the spine — same goods no matter how many times they change hands.
 */
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { ActorContext, DbClient } from "./dealModel";
import { allocateCounter, buildSpineCode, childSpineCode, SPINE_SCOPE } from "./numbering";

export type SpineLifeStage = "spec" | "lot";
export type SpineOrigin = "root" | "split" | "merge";
export type SpineRelation = "split_from" | "merged_from";

/** The goods identity carried by a spine. */
export interface SpineProduct {
  woodSpecies: string | null;
  productType: string | null;
  processing: string | null; // finish
  quality: string | null;
  certificate: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  pieces: string | null;
  volumeM3: number | null;
}

export interface SpineView {
  id: string;
  code: string; // SP-###
  title: string | null;
  lifeStage: SpineLifeStage;
  status: string; // rolled-up status cache (recomputeSpineStatus)
  productGroup: string | null;
  origin: SpineOrigin;
  parentSpineId: string | null;
  product: SpineProduct;
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
  buyerOrgId: string | null; // buyer_organisation_id (E2), customer fallback for pre-backfill rows
}

export interface SpineLineageRow {
  spineId: string;
  relatedSpineId: string;
  relation: SpineRelation;
}

const SPINE_SELECT =
  "id, code, title, life_stage, status, product_group, origin, parent_spine_id, " +
  "wood_species, product_type, processing, quality, certificate, thickness, width, length, pieces, volume_m3, " +
  "notes, created_at, updated_at";

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
    product: {
      woodSpecies: row.wood_species ?? null,
      productType: row.product_type ?? null,
      processing: row.processing ?? null,
      quality: row.quality ?? null,
      certificate: row.certificate ?? null,
      thickness: row.thickness ?? null,
      width: row.width ?? null,
      length: row.length ?? null,
      pieces: row.pieces ?? null,
      volumeM3: row.volume_m3 != null ? Number(row.volume_m3) : null,
    },
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function productToRow(p: Partial<SpineProduct> | undefined): Record<string, unknown> {
  if (!p) return {};
  const out: Record<string, unknown> = {};
  if ("woodSpecies" in p) out.wood_species = p.woodSpecies ?? null;
  if ("productType" in p) out.product_type = p.productType ?? null;
  if ("processing" in p) out.processing = p.processing ?? null;
  if ("quality" in p) out.quality = p.quality ?? null;
  if ("certificate" in p) out.certificate = p.certificate ?? null;
  if ("thickness" in p) out.thickness = p.thickness ?? null;
  if ("width" in p) out.width = p.width ?? null;
  if ("length" in p) out.length = p.length ?? null;
  if ("pieces" in p) out.pieces = p.pieces ?? null;
  if ("volumeM3" in p) out.volume_m3 = p.volumeM3 ?? null;
  return out;
}

// ── pure logic (unit-tested) ────────────────────────────────────────────────

/** Ordered stages for rollup (cancelled handled separately). Higher = more advanced. */
const STATUS_RANK: Record<string, number> = {
  draft: 0,
  pending: 1,
  confirmed: 2,
  in_progress: 3,
  shipped: 4,
  loaded: 5,
  completed: 6,
};

/**
 * Roll a spine's status up from its member deals' statuses. A chain is only as
 * advanced as its LEAST-advanced active leg (the goods aren't delivered until
 * every leg is). Empty → 'draft'; all-cancelled → 'cancelled'.
 */
export function rollupSpineStatus(dealStatuses: string[]): string {
  if (dealStatuses.length === 0) return "draft";
  const active = dealStatuses.filter((s) => s !== "cancelled");
  if (active.length === 0) return "cancelled";
  let min: string = active[0]!;
  for (const s of active) {
    if ((STATUS_RANK[s] ?? 0) < (STATUS_RANK[min] ?? 0)) min = s;
  }
  return min;
}

// ── writes / reads ──────────────────────────────────────────────────────────

export interface CreateSpineInput {
  title?: string | null;
  lifeStage?: SpineLifeStage;
  productGroup?: string | null;
  origin?: SpineOrigin;
  parentSpineId?: string | null;
  notes?: string | null;
  product?: Partial<SpineProduct>;
  /** Override the allocated SP-### code (used for split children, e.g. SP-042-A). */
  codeOverride?: string;
}

async function insertSpine(
  db: DbClient,
  actor: ActorContext,
  code: string,
  input: CreateSpineInput,
): Promise<ActionResult<SpineView>> {
  const insert = {
    code,
    title: input.title ?? null,
    life_stage: input.lifeStage ?? "spec",
    product_group: input.productGroup ?? null,
    origin: input.origin ?? "root",
    parent_spine_id: input.parentSpineId ?? null,
    notes: input.notes ?? null,
    created_by: actor.portalUserId,
    ...productToRow(input.product),
  };
  const { data: row, error } = await db.from("spines").insert(insert).select(SPINE_SELECT).single();
  if (error || !row) return { success: false, error: error?.message ?? "Failed to create spine", code: "CREATE_FAILED" };
  return { success: true, data: mapSpine(row) };
}

/** Create a spine, atomically allocating the next SP-### code (or using codeOverride). */
export async function createSpine(
  db: DbClient,
  actor: ActorContext,
  input: CreateSpineInput = {},
): Promise<ActionResult<SpineView>> {
  let code = input.codeOverride;
  if (!code) {
    try {
      const seq = await allocateCounter(db, SPINE_SCOPE);
      code = buildSpineCode(seq);
    } catch (e) {
      return { success: false, error: (e as Error).message, code: "COUNTER_FAILED" };
    }
  }
  return insertSpine(db, actor, code, input);
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

/** Update the spine's shared product definition. */
export async function updateSpineProduct(
  db: DbClient,
  _actor: ActorContext,
  spineId: string,
  product: Partial<SpineProduct>,
): Promise<ActionResult<SpineView>> {
  if (!isValidUUID(spineId)) return { success: false, error: "Invalid spine id", code: "VALIDATION_ERROR" };
  const patch = productToRow(product);
  if (Object.keys(patch).length === 0) return getSpine(db, _actor, spineId);
  const { data: row, error } = await db.from("spines").update(patch).eq("id", spineId).select(SPINE_SELECT).single();
  if (error || !row) return { success: false, error: error?.message ?? "Spine not found", code: "UPDATE_FAILED" };
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
    .select("id, code, deal_code, name, status, seller_organisation_id, buyer_organisation_id, customer_organisation_id")
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
      // buyer is canonical since E2; customer fallback covers pre-backfill rows
      buyerOrgId: r.buyer_organisation_id ?? r.customer_organisation_id ?? null,
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

/** Transition a spine from Spec (planned) to Lot (physical) — one-way, identity preserved. */
export async function transitionSpineToLot(
  db: DbClient,
  _actor: ActorContext,
  spineId: string,
): Promise<ActionResult<SpineView>> {
  if (!isValidUUID(spineId)) return { success: false, error: "Invalid spine id", code: "VALIDATION_ERROR" };
  const current = await getSpine(db, _actor, spineId);
  if (!current.success) return current;
  if (current.data.lifeStage === "lot") return current; // idempotent
  const { data: row, error } = await db
    .from("spines")
    .update({ life_stage: "lot" })
    .eq("id", spineId)
    .select(SPINE_SELECT)
    .single();
  if (error || !row) return { success: false, error: error?.message ?? "Transition failed", code: "UPDATE_FAILED" };
  return { success: true, data: mapSpine(row) };
}

/** Link an inventory package (physical lot) to a spine. */
export async function linkLotToSpine(
  db: DbClient,
  _actor: ActorContext,
  packageId: string,
  spineId: string,
): Promise<ActionResult<true>> {
  if (!isValidUUID(packageId) || !isValidUUID(spineId)) {
    return { success: false, error: "Invalid id", code: "VALIDATION_ERROR" };
  }
  const { error } = await db.from("inventory_packages").update({ spine_id: spineId }).eq("id", packageId);
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  return { success: true, data: true };
}

export interface SplitChildInput {
  suffix: string; // "A", "B", …
  title?: string | null;
  product?: Partial<SpineProduct>;
}

/**
 * Split a spine into child spines (SP-042 → SP-042-A / SP-042-B), preserving
 * lineage: children carry `origin='split'`, `parent_spine_id`, inherit the parent
 * product definition (overridable per child), and get a `spine_lineage` row.
 */
export async function splitSpine(
  db: DbClient,
  actor: ActorContext,
  spineId: string,
  children: SplitChildInput[],
): Promise<ActionResult<SpineView[]>> {
  if (!isValidUUID(spineId)) return { success: false, error: "Invalid spine id", code: "VALIDATION_ERROR" };
  if (children.length < 2) return { success: false, error: "A split needs at least 2 children", code: "VALIDATION_ERROR" };
  const parentRes = await getSpine(db, actor, spineId);
  if (!parentRes.success) return parentRes as unknown as ActionResult<SpineView[]>;
  const parent = parentRes.data;

  const created: SpineView[] = [];
  for (const child of children) {
    const res = await insertSpine(db, actor, childSpineCode(parent.code, child.suffix), {
      title: child.title ?? parent.title,
      lifeStage: parent.lifeStage,
      productGroup: parent.productGroup,
      origin: "split",
      parentSpineId: parent.id,
      product: child.product ?? parent.product,
    });
    if (!res.success) return res as unknown as ActionResult<SpineView[]>;
    const { error: linErr } = await db
      .from("spine_lineage")
      .insert({ spine_id: res.data.id, related_spine_id: parent.id, relation: "split_from" });
    if (linErr) return { success: false, error: linErr.message, code: "LINEAGE_FAILED" };
    created.push(res.data);
  }
  return { success: true, data: created };
}

/**
 * Merge several source spines into one fulfilment spine (new SP-###, origin='merge'),
 * recording a `merged_from` lineage row per source.
 */
export async function mergeSpines(
  db: DbClient,
  actor: ActorContext,
  sourceSpineIds: string[],
  target: CreateSpineInput = {},
): Promise<ActionResult<SpineView>> {
  if (sourceSpineIds.length < 2) return { success: false, error: "A merge needs at least 2 source spines", code: "VALIDATION_ERROR" };
  if (sourceSpineIds.some((id) => !isValidUUID(id))) return { success: false, error: "Invalid source spine id", code: "VALIDATION_ERROR" };
  const res = await createSpine(db, actor, { ...target, origin: "merge" });
  if (!res.success) return res;
  const rows = sourceSpineIds.map((sid) => ({ spine_id: res.data.id, related_spine_id: sid, relation: "merged_from" }));
  const { error: linErr } = await db.from("spine_lineage").insert(rows);
  if (linErr) return { success: false, error: linErr.message, code: "LINEAGE_FAILED" };
  return { success: true, data: res.data };
}

/** Lineage both directions: where this spine came FROM (sources) and what came FROM it (derived). */
export async function getSpineLineage(
  db: DbClient,
  _actor: ActorContext,
  spineId: string,
): Promise<ActionResult<{ sources: SpineLineageRow[]; derived: SpineLineageRow[] }>> {
  if (!isValidUUID(spineId)) return { success: false, error: "Invalid spine id", code: "VALIDATION_ERROR" };
  const map = (rows: unknown[] | null): SpineLineageRow[] =>
    (rows ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => ({ spineId: r.spine_id, relatedSpineId: r.related_spine_id, relation: r.relation }),
    );
  const [{ data: srcRows, error: srcErr }, { data: derRows, error: derErr }] = await Promise.all([
    db.from("spine_lineage").select("spine_id, related_spine_id, relation").eq("spine_id", spineId),
    db.from("spine_lineage").select("spine_id, related_spine_id, relation").eq("related_spine_id", spineId),
  ]);
  if (srcErr) return { success: false, error: srcErr.message, code: "FETCH_FAILED" };
  if (derErr) return { success: false, error: derErr.message, code: "FETCH_FAILED" };
  return { success: true, data: { sources: map(srcRows), derived: map(derRows) } };
}

/** Recompute + persist the spine's rolled-up status from its member deals. */
export async function recomputeSpineStatus(
  db: DbClient,
  actor: ActorContext,
  spineId: string,
): Promise<ActionResult<{ status: string }>> {
  if (!isValidUUID(spineId)) return { success: false, error: "Invalid spine id", code: "VALIDATION_ERROR" };
  const deals = await listSpineDeals(db, actor, spineId);
  if (!deals.success) return deals as unknown as ActionResult<{ status: string }>;
  const status = rollupSpineStatus(deals.data.map((d) => d.status));
  const { error } = await db.from("spines").update({ status }).eq("id", spineId);
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  return { success: true, data: { status } };
}
