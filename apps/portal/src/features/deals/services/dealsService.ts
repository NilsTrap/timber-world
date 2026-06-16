/**
 * Deals service layer — shared business logic.
 *
 * Functions take `(db, actor, input)` where `db` is a Supabase client chosen by
 * the caller (server client for UI / RLS, admin client for the MCP service
 * identity) and `actor` is used for audit only. Permission is enforced by the
 * caller (server action checks the session module; MCP route checks the bearer).
 *
 * The generated Database types don't yet include the new `deals*` tables, so we
 * cast the client to `any` for those queries — the same pattern used across this
 * codebase.
 */
import type {
  ActionResult,
  ActorContext,
  CreateDealInput,
  Deal,
  DealLineItem,
  DealExternalRef,
  DealSide,
  DbClient,
} from "../types";
import { isValidUUID } from "../types";
import {
  allocateCounter,
  buildDealCode,
  clientCodeFromName,
  dealCodeScope,
} from "./numbering";

const DEFAULT_ENTITY_CODE = "TIM"; // Timber International (single trading entity, MVP)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

const DEAL_SELECT = `
  id, code, deal_kind, product_group,
  seller_organisation_id, customer_organisation_id, producer_organisation_id,
  currency, incoterms, incoterms_place, advance_pct, payment_terms,
  delivery_terms, delivery_deadline, transport_billing, status, notes,
  created_by, created_at, updated_at,
  seller:organisations!deals_seller_organisation_id_fkey(id, code, name),
  customer:organisations!deals_customer_organisation_id_fkey(id, code, name),
  producer:organisations!deals_producer_organisation_id_fkey(id, code, name)
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDeal(row: any): Deal {
  return {
    id: row.id,
    code: row.code,
    dealKind: row.deal_kind,
    productGroup: row.product_group ?? null,
    seller: { id: row.seller_organisation_id ?? null, code: row.seller?.code ?? null, name: row.seller?.name ?? null },
    customer: { id: row.customer_organisation_id ?? null, code: row.customer?.code ?? null, name: row.customer?.name ?? null },
    producer: { id: row.producer_organisation_id ?? null, code: row.producer?.code ?? null, name: row.producer?.name ?? null },
    currency: row.currency,
    incoterms: row.incoterms ?? null,
    incotermsPlace: row.incoterms_place ?? null,
    advancePct: row.advance_pct != null ? Number(row.advance_pct) : null,
    paymentTerms: row.payment_terms ?? null,
    deliveryTerms: row.delivery_terms ?? null,
    deliveryDeadline: row.delivery_deadline ?? null,
    transportBilling: row.transport_billing,
    status: row.status,
    notes: row.notes ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLineItem(row: any): DealLineItem {
  return {
    id: row.id,
    dealId: row.deal_id,
    side: row.side,
    lineNo: row.line_no,
    productName: row.product_name ?? null,
    woodSpecies: row.wood_species ?? null,
    humidity: row.humidity ?? null,
    processing: row.processing ?? null,
    quality: row.quality ?? null,
    gradeNote: row.grade_note ?? null,
    thickness: row.thickness ?? null,
    width: row.width ?? null,
    length: row.length ?? null,
    pieces: row.pieces ?? null,
    volumeM3: row.volume_m3 != null ? Number(row.volume_m3) : null,
    unit: row.unit,
    unitPriceCents: row.unit_price_cents ?? null,
    vatRate: row.vat_rate != null ? Number(row.vat_rate) : null,
    lineTotalCents: row.line_total_cents ?? null,
    notes: row.notes ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRef(row: any): DealExternalRef {
  return { id: row.id, dealId: row.deal_id, refType: row.ref_type, refValue: row.ref_value, label: row.label ?? null };
}

async function resolveEntityCode(db: AnyDb, sellerOrgId: string | null | undefined): Promise<string> {
  if (!sellerOrgId) return DEFAULT_ENTITY_CODE;
  const { data } = await db.from("organisations").select("code").eq("id", sellerOrgId).single();
  return (data?.code as string | undefined)?.toUpperCase() || DEFAULT_ENTITY_CODE;
}

async function resolveCustomerName(
  db: AnyDb,
  customerOrgId: string | null | undefined,
  fallback: string | null | undefined
): Promise<string | null> {
  if (customerOrgId) {
    const { data } = await db.from("organisations").select("name").eq("id", customerOrgId).single();
    if (data?.name) return data.name as string;
  }
  return fallback ?? null;
}

export async function createDeal(
  db: DbClient,
  actor: ActorContext,
  input: CreateDealInput
): Promise<ActionResult<Deal>> {
  const c = db as AnyDb;

  // Idempotency: if a deal already carries this key as an external ref, return it.
  if (input.idempotencyKey) {
    const { data: existing } = await c
      .from("deal_external_refs")
      .select("deal_id")
      .eq("ref_type", "other")
      .eq("ref_value", `idem:${input.idempotencyKey}`)
      .limit(1)
      .maybeSingle();
    if (existing?.deal_id) {
      return getDeal(db, actor, existing.deal_id);
    }
  }

  const entityCode = await resolveEntityCode(c, input.sellerOrganisationId);
  const customerName = await resolveCustomerName(c, input.customerOrganisationId, input.customerNameForCode);
  const clientCode = clientCodeFromName(customerName);

  let seq: number;
  try {
    seq = await allocateCounter(db, dealCodeScope(entityCode, clientCode));
  } catch (e) {
    return { success: false, error: (e as Error).message, code: "COUNTER_FAILED" };
  }
  const code = buildDealCode(entityCode, clientCode, seq);

  const { data: dealRow, error } = await c
    .from("deals")
    .insert({
      code,
      deal_kind: input.dealKind ?? "buy_sell",
      product_group: input.productGroup ?? null,
      seller_organisation_id: input.sellerOrganisationId ?? null,
      customer_organisation_id: input.customerOrganisationId ?? null,
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

  if (error || !dealRow) {
    return { success: false, error: error?.message ?? "Failed to create deal", code: "CREATE_FAILED" };
  }
  const dealId = dealRow.id as string;

  // Line items
  if (input.lineItems && input.lineItems.length > 0) {
    const res = await replaceLineItems(db, actor, dealId, "sell", input.lineItems);
    if (!res.success) return res as ActionResult<Deal>;
  }

  // External refs (+ idempotency marker)
  const refs: DealExternalRef[] = [...(input.externalRefs ?? [])];
  if (input.idempotencyKey) {
    refs.push({ refType: "other", refValue: `idem:${input.idempotencyKey}`, label: "idempotency" });
  }
  if (refs.length > 0) {
    await c.from("deal_external_refs").insert(
      refs.map((r) => ({ deal_id: dealId, ref_type: r.refType, ref_value: r.refValue, label: r.label ?? null }))
    );
  }

  return getDeal(db, actor, dealId);
}

export async function getDeal(db: DbClient, _actor: ActorContext, dealId: string): Promise<ActionResult<Deal>> {
  if (!isValidUUID(dealId)) return { success: false, error: "Invalid deal id", code: "VALIDATION_ERROR" };
  const c = db as AnyDb;

  const { data: row, error } = await c.from("deals").select(DEAL_SELECT).eq("id", dealId).single();
  if (error || !row) return { success: false, error: error?.message ?? "Deal not found", code: "NOT_FOUND" };

  const deal = mapDeal(row);

  const [{ data: items }, { data: refs }, { data: docs }] = await Promise.all([
    c.from("deal_line_items").select("*").eq("deal_id", dealId).order("side").order("line_no"),
    c.from("deal_external_refs").select("*").eq("deal_id", dealId).order("created_at"),
    c.from("deal_documents").select("id, deal_id, doc_type, side, doc_number, status, storage_path, file_name, created_at").eq("deal_id", dealId).order("created_at", { ascending: false }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal.lineItems = (items ?? []).map(mapLineItem);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal.externalRefs = (refs ?? []).map(mapRef);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal.documents = (docs ?? []).map((d: any) => ({
    id: d.id, dealId: d.deal_id, docType: d.doc_type, side: d.side, docNumber: d.doc_number,
    status: d.status, storagePath: d.storage_path ?? null, fileName: d.file_name ?? null, createdAt: d.created_at,
  }));

  return { success: true, data: deal };
}

export interface ListDealsFilters {
  status?: string;
  productGroup?: string;
  limit?: number;
}

export async function listDeals(
  db: DbClient,
  _actor: ActorContext,
  filters: ListDealsFilters = {}
): Promise<ActionResult<Deal[]>> {
  const c = db as AnyDb;
  let query = c.from("deals").select(DEAL_SELECT).order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.productGroup) query = query.eq("product_group", filters.productGroup);
  query = query.limit(Math.min(filters.limit ?? 100, 200));

  const { data, error } = await query;
  if (error) return { success: false, error: error.message, code: "FETCH_FAILED" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { success: true, data: (data ?? []).map(mapDeal) };
}

export async function updateDeal(
  db: DbClient,
  _actor: ActorContext,
  dealId: string,
  patch: Partial<CreateDealInput> & { status?: Deal["status"] }
): Promise<ActionResult<Deal>> {
  if (!isValidUUID(dealId)) return { success: false, error: "Invalid deal id", code: "VALIDATION_ERROR" };
  const c = db as AnyDb;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  if (patch.productGroup !== undefined) update.product_group = patch.productGroup;
  if (patch.customerOrganisationId !== undefined) update.customer_organisation_id = patch.customerOrganisationId;
  if (patch.producerOrganisationId !== undefined) update.producer_organisation_id = patch.producerOrganisationId;
  if (patch.sellerOrganisationId !== undefined) update.seller_organisation_id = patch.sellerOrganisationId;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.incoterms !== undefined) update.incoterms = patch.incoterms;
  if (patch.incotermsPlace !== undefined) update.incoterms_place = patch.incotermsPlace;
  if (patch.advancePct !== undefined) update.advance_pct = patch.advancePct;
  if (patch.paymentTerms !== undefined) update.payment_terms = patch.paymentTerms;
  if (patch.deliveryTerms !== undefined) update.delivery_terms = patch.deliveryTerms;
  if (patch.deliveryDeadline !== undefined) update.delivery_deadline = patch.deliveryDeadline;
  if (patch.transportBilling !== undefined) update.transport_billing = patch.transportBilling;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.status !== undefined) update.status = patch.status;

  if (Object.keys(update).length > 0) {
    const { error } = await c.from("deals").update(update).eq("id", dealId);
    if (error) return { success: false, error: error.message, code: "UPDATE_FAILED" };
  }
  return getDeal(db, _actor, dealId);
}

/** Replace all line items for a deal+side (predictable for editable tables). */
export async function replaceLineItems(
  db: DbClient,
  _actor: ActorContext,
  dealId: string,
  side: DealSide,
  items: Partial<DealLineItem>[]
): Promise<ActionResult<DealLineItem[]>> {
  if (!isValidUUID(dealId)) return { success: false, error: "Invalid deal id", code: "VALIDATION_ERROR" };
  const c = db as AnyDb;

  const { error: delErr } = await c.from("deal_line_items").delete().eq("deal_id", dealId).eq("side", side);
  if (delErr) return { success: false, error: delErr.message, code: "DELETE_FAILED" };

  if (items.length === 0) return { success: true, data: [] };

  const rows = items.map((it, i) => ({
    deal_id: dealId,
    side,
    line_no: it.lineNo ?? i + 1,
    product_name: it.productName ?? null,
    wood_species: it.woodSpecies ?? null,
    humidity: it.humidity ?? null,
    processing: it.processing ?? null,
    quality: it.quality ?? null,
    grade_note: it.gradeNote ?? null,
    thickness: it.thickness ?? null,
    width: it.width ?? null,
    length: it.length ?? null,
    pieces: it.pieces ?? null,
    volume_m3: it.volumeM3 ?? null,
    unit: it.unit ?? "m3",
    unit_price_cents: it.unitPriceCents ?? null,
    vat_rate: it.vatRate ?? null,
    line_total_cents: it.lineTotalCents ?? null,
    notes: it.notes ?? null,
  }));

  const { data, error } = await c.from("deal_line_items").insert(rows).select("*");
  if (error) return { success: false, error: error.message, code: "INSERT_FAILED" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { success: true, data: (data ?? []).map(mapLineItem) };
}

export async function setExternalRefs(
  db: DbClient,
  _actor: ActorContext,
  dealId: string,
  refs: DealExternalRef[]
): Promise<ActionResult<DealExternalRef[]>> {
  if (!isValidUUID(dealId)) return { success: false, error: "Invalid deal id", code: "VALIDATION_ERROR" };
  const c = db as AnyDb;

  // Preserve idempotency markers; replace user-facing refs only.
  await c.from("deal_external_refs").delete().eq("deal_id", dealId).neq("ref_type", "other");
  if (refs.length === 0) return { success: true, data: [] };

  const { data, error } = await c
    .from("deal_external_refs")
    .insert(refs.map((r) => ({ deal_id: dealId, ref_type: r.refType, ref_value: r.refValue, label: r.label ?? null })))
    .select("*");
  if (error) return { success: false, error: error.message, code: "INSERT_FAILED" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { success: true, data: (data ?? []).map(mapRef) };
}
