/**
 * Order-as-deal service: the universal deal layer over `orders`.
 *
 * Functions take `(db, actor, input)`; `db` = caller-chosen Supabase client
 * (server for UI/RLS, admin for the MCP service identity). Permission is enforced
 * by the caller. Casts to `any` for the new columns/tables (generated DB types
 * don't include them yet) — matches the codebase convention.
 */
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import {
  type ActorContext,
  type DealFieldsPatch,
  type DealKind,
  type DealSide,
  type TransportBilling,
  type OrderExternalRef,
  type OrderLineItem,
  type OrderDocumentMeta,
  type DbClient,
  mapLineItem,
  lineItemToRow,
} from "./dealModel";
import { allocateCounter, buildDealCode, clientCodeFromName, dealCodeScope } from "./numbering";

const DEFAULT_ENTITY_CODE = "TIM";

export interface OrderDealView {
  id: string;
  code: string; // ORD-### legacy code
  dealCode: string | null; // Nils-convention deal code
  name: string | null;
  dealKind: string;
  productGroup: string | null;
  currency: string;
  status: string;
  incoterms: string | null;
  incotermsPlace: string | null;
  advancePct: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  deliveryDeadline: string | null;
  transportBilling: string;
  notes: string | null;
  customer: { id: string | null; code: string | null; name: string | null };
  seller: { id: string | null; code: string | null; name: string | null };
  producer: { id: string | null; code: string | null; name: string | null };
  lineItems: OrderLineItem[];
  externalRefs: OrderExternalRef[];
  documents: OrderDocumentMeta[];
}

/** List/summary shape — the deal header without the heavy related collections. */
export type OrderDealSummary = Omit<OrderDealView, "lineItems" | "externalRefs" | "documents">;

const ORDER_SELECT = `
  id, code, deal_code, name, deal_kind, product_group, currency, status,
  incoterms, incoterms_place, advance_pct, payment_terms, delivery_terms,
  delivery_deadline, transport_billing, notes,
  customer_organisation_id, seller_organisation_id, producer_organisation_id,
  customer:organisations!orders_customer_organisation_id_fkey(id, code, name),
  seller:organisations!orders_seller_organisation_id_fkey(id, code, name),
  producer:organisations!orders_producer_organisation_id_fkey(id, code, name)
`;

/** Map an `orders` row (selected with ORDER_SELECT) to the deal header. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrderDealHeader(row: any): OrderDealSummary {
  return {
    id: row.id,
    code: row.code,
    dealCode: row.deal_code ?? null,
    name: row.name ?? null,
    dealKind: row.deal_kind ?? "buy_sell",
    productGroup: row.product_group ?? null,
    currency: row.currency,
    status: row.status,
    incoterms: row.incoterms ?? null,
    incotermsPlace: row.incoterms_place ?? null,
    advancePct: row.advance_pct != null ? Number(row.advance_pct) : null,
    paymentTerms: row.payment_terms ?? null,
    deliveryTerms: row.delivery_terms ?? null,
    deliveryDeadline: row.delivery_deadline ?? null,
    transportBilling: row.transport_billing ?? "in_price",
    notes: row.notes ?? null,
    customer: { id: row.customer_organisation_id ?? null, code: row.customer?.code ?? null, name: row.customer?.name ?? null },
    seller: { id: row.seller_organisation_id ?? null, code: row.seller?.code ?? null, name: row.seller?.name ?? null },
    producer: { id: row.producer_organisation_id ?? null, code: row.producer?.code ?? null, name: row.producer?.name ?? null },
  };
}

export async function getOrderDeal(db: DbClient, _actor: ActorContext, orderId: string): Promise<ActionResult<OrderDealView>> {
  if (!isValidUUID(orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  const c = db as DbClient;

  const { data: row, error } = await c.from("orders").select(ORDER_SELECT).eq("id", orderId).single();
  if (error || !row) return { success: false, error: error?.message ?? "Order not found", code: "NOT_FOUND" };

  const [{ data: items }, { data: refs }, { data: docs }] = await Promise.all([
    c.from("order_line_items").select("*").eq("order_id", orderId).order("side").order("line_no"),
    c.from("order_external_refs").select("*").eq("order_id", orderId).order("created_at"),
    c.from("order_documents").select("id, order_id, doc_type, side, doc_number, status, storage_path, file_name, oscar_doc_id, oscar_doc_url, created_at").eq("order_id", orderId).order("created_at", { ascending: false }),
  ]);

  const view: OrderDealView = {
    ...mapOrderDealHeader(row),
    lineItems: (items ?? []).map(mapLineItem),
    externalRefs: (refs ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, orderId: r.order_id as string, refType: r.ref_type as OrderExternalRef["refType"], refValue: r.ref_value as string, label: (r.label as string) ?? null,
    })),
    documents: (docs ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as string, orderId: d.order_id as string, docType: d.doc_type as OrderDocumentMeta["docType"], side: d.side as DealSide,
      docNumber: d.doc_number as string, status: d.status as OrderDocumentMeta["status"],
      storagePath: (d.storage_path as string) ?? null, fileName: (d.file_name as string) ?? null,
      oscarDocId: (d.oscar_doc_id as string) ?? null, oscarDocUrl: (d.oscar_doc_url as string) ?? null, createdAt: d.created_at as string,
    })),
  };
  return { success: true, data: view };
}

/** Valid `orders.status` enum values (order_status). Used to guard the filter. */
export const ORDER_STATUSES = ["draft", "pending", "confirmed", "in_progress", "shipped", "completed", "loaded", "cancelled"] as const;

export interface ListOrderDealsFilters {
  status?: string;
  productGroup?: string;
  limit?: number;
}

/** List deals (orders) newest-first, header only. Filter by status / product group. */
export async function listDeals(db: DbClient, _actor: ActorContext, filters: ListOrderDealsFilters = {}): Promise<ActionResult<OrderDealSummary[]>> {
  // Guard the status filter: passing a value outside the enum makes Postgres
  // raise an enum-cast error, so validate up front with a helpful message.
  if (filters.status && !(ORDER_STATUSES as readonly string[]).includes(filters.status)) {
    return { success: false, error: `Invalid status "${filters.status}". Valid: ${ORDER_STATUSES.join(", ")}.`, code: "VALIDATION_ERROR" };
  }
  const c = db as DbClient;
  let query = c.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.productGroup) query = query.eq("product_group", filters.productGroup);
  query = query.limit(Math.min(filters.limit ?? 100, 200));
  const { data, error } = await query;
  if (error) return { success: false, error: error.message, code: "FETCH_FAILED" };
  return { success: true, data: (data ?? []).map(mapOrderDealHeader) };
}

export async function updateDealFields(db: DbClient, _actor: ActorContext, orderId: string, patch: DealFieldsPatch): Promise<ActionResult<true>> {
  if (!isValidUUID(orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  const c = db as DbClient;
  const u: Record<string, unknown> = {};
  if (patch.dealKind !== undefined) u.deal_kind = patch.dealKind;
  if (patch.productGroup !== undefined) u.product_group = patch.productGroup;
  if (patch.incoterms !== undefined) u.incoterms = patch.incoterms;
  if (patch.incotermsPlace !== undefined) u.incoterms_place = patch.incotermsPlace;
  if (patch.advancePct !== undefined) u.advance_pct = patch.advancePct;
  if (patch.paymentTerms !== undefined) u.payment_terms = patch.paymentTerms;
  if (patch.deliveryTerms !== undefined) u.delivery_terms = patch.deliveryTerms;
  if (patch.deliveryDeadline !== undefined) u.delivery_deadline = patch.deliveryDeadline;
  if (patch.transportBilling !== undefined) u.transport_billing = patch.transportBilling;
  if (Object.keys(u).length === 0) return { success: true, data: true };
  const { error } = await c.from("orders").update(u).eq("id", orderId);
  if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  return { success: true, data: true };
}

/** Replace all line items for an order+side (predictable for editable tables). */
export async function replaceLineItems(db: DbClient, _actor: ActorContext, orderId: string, side: DealSide, items: Partial<OrderLineItem>[]): Promise<ActionResult<OrderLineItem[]>> {
  if (!isValidUUID(orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  const c = db as DbClient;
  const { error: delErr } = await c.from("order_line_items").delete().eq("order_id", orderId).eq("side", side);
  if (delErr) return { success: false, error: delErr.message, code: "DELETE_FAILED" };
  if (items.length === 0) return { success: true, data: [] };
  const rows = items.map((it, i) => lineItemToRow(orderId, { ...it, side }, i));
  const { data, error } = await c.from("order_line_items").insert(rows).select("*");
  if (error) return { success: false, error: error.message, code: "INSERT_FAILED" };
  return { success: true, data: (data ?? []).map(mapLineItem) };
}

export async function setExternalRefs(db: DbClient, _actor: ActorContext, orderId: string, refs: OrderExternalRef[]): Promise<ActionResult<OrderExternalRef[]>> {
  if (!isValidUUID(orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  const c = db as DbClient;
  await c.from("order_external_refs").delete().eq("order_id", orderId).neq("ref_type", "other");
  if (refs.length === 0) return { success: true, data: [] };
  const { data, error } = await c
    .from("order_external_refs")
    .insert(refs.map((r) => ({ order_id: orderId, ref_type: r.refType, ref_value: r.refValue, label: r.label ?? null })))
    .select("*");
  if (error) return { success: false, error: error.message, code: "INSERT_FAILED" };
  return { success: true, data: (data ?? []).map((r: Record<string, unknown>) => ({ id: r.id as string, orderId: r.order_id as string, refType: r.ref_type as OrderExternalRef["refType"], refValue: r.ref_value as string, label: (r.label as string) ?? null })) };
}

/**
 * Allocate and persist the Nils-convention deal code (entity+client+seq) if not
 * set. `customerNameFallback` supplies the client part when the deal has no
 * customer org row yet (e.g. an MCP create that only knows the buyer's name).
 */
export async function allocateDealCode(
  db: DbClient,
  _actor: ActorContext,
  orderId: string,
  opts?: { customerNameFallback?: string | null }
): Promise<ActionResult<{ dealCode: string }>> {
  if (!isValidUUID(orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };
  const c = db as DbClient;
  const { data: row, error } = await c
    .from("orders")
    .select("deal_code, customer_organisation_id, seller_organisation_id, customer:organisations!orders_customer_organisation_id_fkey(name), seller:organisations!orders_seller_organisation_id_fkey(code)")
    .eq("id", orderId)
    .single();
  if (error || !row) return { success: false, error: error?.message ?? "Order not found", code: "NOT_FOUND" };
  if (row.deal_code) return { success: true, data: { dealCode: row.deal_code } };

  const entityCode = (row.seller?.code as string | undefined)?.toUpperCase() || DEFAULT_ENTITY_CODE;
  const clientCode = clientCodeFromName((row.customer?.name as string | undefined) ?? opts?.customerNameFallback ?? undefined);
  let seq: number;
  try {
    seq = await allocateCounter(db, dealCodeScope(entityCode, clientCode));
  } catch (e) {
    return { success: false, error: (e as Error).message, code: "COUNTER_FAILED" };
  }
  const dealCode = buildDealCode(entityCode, clientCode, seq);
  const { error: upErr } = await c.from("orders").update({ deal_code: dealCode }).eq("id", orderId);
  if (upErr) return { success: false, error: upErr.message, code: "UPDATE_FAILED" };
  return { success: true, data: { dealCode } };
}

export interface CreateOrderDealInput {
  name?: string | null;
  productGroup?: string | null;
  dealKind?: DealKind;
  sellerOrganisationId?: string | null;
  customerOrganisationId?: string | null;
  producerOrganisationId?: string | null;
  currency?: string;
  incoterms?: string | null;
  incotermsPlace?: string | null;
  advancePct?: number | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  deliveryDeadline?: string | null;
  transportBilling?: TransportBilling;
  notes?: string | null;
  /** Human-readable buyer name used for the deal code when no customer org row. */
  customerNameForCode?: string | null;
  /** Idempotency key (stored as an external ref of type "other") to dedupe creates. */
  idempotencyKey?: string | null;
  lineItems?: Partial<OrderLineItem>[];
  externalRefs?: Omit<OrderExternalRef, "id" | "orderId">[];
}

/**
 * Create a deal as an `orders` row. The legacy `code` (ORD-###) is filled by the
 * DB default; the Nils-convention `deal_code` is allocated here (numbering wired
 * into create — E2.3). Idempotent on `idempotencyKey` via an external ref.
 */
export async function createDeal(db: DbClient, actor: ActorContext, input: CreateOrderDealInput): Promise<ActionResult<OrderDealView>> {
  const c = db as DbClient;

  // Idempotency: if a deal already carries this key as an external ref, return it.
  if (input.idempotencyKey) {
    const { data: existing } = await c
      .from("order_external_refs")
      .select("order_id")
      .eq("ref_type", "other")
      .eq("ref_value", `idem:${input.idempotencyKey}`)
      .limit(1)
      .maybeSingle();
    if (existing?.order_id) return getOrderDeal(db, actor, existing.order_id);
  }

  // `orders.name` is NOT NULL with no DB default — deals created via MCP often
  // omit a name, so derive a sensible non-null label (customer → product group → generic).
  const dealName =
    input.name ??
    input.customerNameForCode ??
    (input.productGroup ? `${input.productGroup} deal` : "Untitled deal");

  const { data: row, error } = await c
    .from("orders")
    .insert({
      name: dealName,
      deal_kind: input.dealKind ?? "buy_sell",
      product_group: input.productGroup ?? null,
      customer_organisation_id: input.customerOrganisationId ?? null,
      seller_organisation_id: input.sellerOrganisationId ?? null,
      producer_organisation_id: input.producerOrganisationId ?? null,
      currency: input.currency ?? "EUR",
      incoterms: input.incoterms ?? null,
      incoterms_place: input.incotermsPlace ?? null,
      advance_pct: input.advancePct ?? null,
      payment_terms: input.paymentTerms ?? null,
      delivery_terms: input.deliveryTerms ?? null,
      delivery_deadline: input.deliveryDeadline ?? null,
      transport_billing: input.transportBilling ?? "in_price",
      status: "draft",
      notes: input.notes ?? null,
      created_by: actor.portalUserId,
    })
    .select("id")
    .single();
  if (error || !row) return { success: false, error: error?.message ?? "Failed to create deal", code: "CREATE_FAILED" };
  const orderId = row.id as string;

  // Allocate the deal code at creation (best-effort: a counter failure must not
  // orphan the row — the code can be re-allocated later via allocateDealCode).
  await allocateDealCode(db, actor, orderId, { customerNameFallback: input.customerNameForCode ?? null });

  if (input.lineItems && input.lineItems.length > 0) {
    const res = await replaceLineItems(db, actor, orderId, "sell", input.lineItems);
    if (!res.success) return res as unknown as ActionResult<OrderDealView>;
  }

  const refs = [...(input.externalRefs ?? [])];
  if (input.idempotencyKey) refs.push({ refType: "other", refValue: `idem:${input.idempotencyKey}`, label: "idempotency" });
  if (refs.length > 0) {
    await c.from("order_external_refs").insert(
      refs.map((r) => ({ order_id: orderId, ref_type: r.refType, ref_value: r.refValue, label: r.label ?? null }))
    );
  }

  return getOrderDeal(db, actor, orderId);
}
