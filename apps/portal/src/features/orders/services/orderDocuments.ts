/**
 * Order/deal document service — assemble render data, allocate the document
 * number (Timber owns numbering), generate the file through the swappable
 * generation port, store it in `order_documents` + the private bucket, and mint
 * signed download URLs.
 *
 * Reads the deal via the passed `db` (respects RLS for UI callers); uses the
 * admin client for storage + the document-row insert (private bucket, signed-URL
 * downloads — no per-object storage RLS needed). Server-only.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { ActorContext, DealSide, DocType, DbClient } from "./dealModel";
import { getOrderDeal } from "./orderDeals";
import { allocateCounter, buildDocNumber, docNumberScope } from "./numbering";
import { buildDocumentData, defaultSideFor } from "./documents/assemble";
import type { DocumentData, PartyCard } from "./documents/types";
import { getDocumentGenerator } from "./documents/port";

const STORAGE_BUCKET = "deal-documents";
const DEFAULT_ENTITY_CODE = "TIM";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export interface DocumentRequest {
  orderId: string;
  docType: DocType;
  /** Defaults: purchase docs → buy side, everything else → sell. */
  side?: DealSide;
}

export interface AssembledDocument {
  data: DocumentData;
  seq: number;
  side: DealSide;
}

export interface GeneratedDocument {
  id: string;
  orderId: string;
  docType: DocType;
  docNumber: string;
  fileName: string;
  storagePath: string;
  generator: string;
  /** Signed download URL (valid ~7 days). */
  url: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick<T = string>(row: Record<string, unknown> | null, keys: string[]): T | null {
  if (!row) return null;
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== "") return v as T;
  }
  return null;
}

/**
 * Build a party's company card from `organisations` (+ optional
 * `organisation_details`). Flexible key fallbacks so it survives schema drift
 * (the richer company-card fields land in E4).
 */
async function fetchPartyCard(admin: AnyDb, orgId: string | null): Promise<PartyCard> {
  if (!orgId) return { name: "—" };
  const { data: org } = await admin.from("organisations").select("*").eq("id", orgId).maybeSingle();
  let details: Record<string, unknown> | null = null;
  try {
    const res = await admin.from("organisation_details").select("*").eq("organisation_id", orgId).maybeSingle();
    details = res.data ?? null;
  } catch {
    details = null; // table may not exist in some environments
  }
  const merged = { ...(details ?? {}), ...(org ?? {}) } as Record<string, unknown>;
  const addressParts = [
    pick(merged, ["address", "legal_address", "street"]),
    pick(merged, ["postal_code", "postcode", "zip"]),
    pick(merged, ["city"]),
    pick(merged, ["country"]),
  ].filter(Boolean);
  return {
    name: (pick(merged, ["name"]) as string) ?? "—",
    regNo: pick(merged, ["reg_no", "registration_number", "company_number", "reg_nr"]),
    vatNo: pick(merged, ["vat_no", "vat_number", "vat", "vat_reg_no"]),
    address: addressParts.length ? addressParts.join(", ") : null,
    country: pick(merged, ["country", "country_code"]),
    email: pick(merged, ["email", "contact_person_email"]),
    phone: pick(merged, ["phone", "contact_person_phone"]),
    bankName: pick(merged, ["bank_name", "bank"]),
    bankAccount: pick(merged, ["bank_account_number", "iban", "account_number"]),
    bankSwift: pick(merged, ["bank_swift_code", "swift_code", "swift", "bic"]),
  };
}

/**
 * Assemble the full render-ready DocumentData for a deal + doc type + side,
 * allocating the document number (Timber owns numbering). This is the payload
 * the Oscar generator consumes (timber_get_document_data) and that the local
 * generator renders.
 */
export async function assembleDocumentData(db: DbClient, actor: ActorContext, input: DocumentRequest): Promise<ActionResult<AssembledDocument>> {
  if (!isValidUUID(input.orderId)) return { success: false, error: "Invalid order id", code: "VALIDATION_ERROR" };

  const dealRes = await getOrderDeal(db, actor, input.orderId);
  if (!dealRes.success) return dealRes as ActionResult<AssembledDocument>;
  const deal = dealRes.data;

  const side: DealSide = input.side ?? defaultSideFor(input.docType);
  const admin = createAdminClient() as AnyDb;

  const sellerCard = await fetchPartyCard(admin, deal.seller.id);
  const buyerOrgId = side === "buy" ? deal.producer.id : deal.customer.id;
  const buyerCard = await fetchPartyCard(admin, buyerOrgId);

  const entityCode = (deal.seller.code || DEFAULT_ENTITY_CODE).toUpperCase();
  const docDate = new Date().toISOString();

  let seq: number;
  try {
    seq = await allocateCounter(db, docNumberScope(input.docType, entityCode, docDate, deal.id));
  } catch (e) {
    return { success: false, error: (e as Error).message, code: "COUNTER_FAILED" };
  }
  const docNumber = buildDocNumber({ docType: input.docType, entityCode, date: docDate, seq });

  const data = buildDocumentData({
    docType: input.docType,
    side,
    docNumber,
    docDate,
    dealCode: deal.dealCode || deal.code,
    currency: deal.currency,
    seller: sellerCard,
    buyer: buyerCard,
    incoterms: deal.incoterms,
    incotermsPlace: deal.incotermsPlace,
    advancePct: deal.advancePct,
    paymentTerms: deal.paymentTerms,
    deliveryTerms: deal.deliveryTerms,
    deliveryDeadline: deal.deliveryDeadline,
    notes: deal.notes,
    externalRefs: deal.externalRefs,
    lineItems: deal.lineItems,
  });

  return { success: true, data: { data, seq, side } };
}

/**
 * Generate (or, for Oscar, request) a document for a deal, store the file and
 * record an `order_documents` row. Returns the row id + a signed download URL.
 */
export async function generateDocument(db: DbClient, actor: ActorContext, input: DocumentRequest): Promise<ActionResult<GeneratedDocument>> {
  const assembled = await assembleDocumentData(db, actor, input);
  if (!assembled.success) return assembled as ActionResult<GeneratedDocument>;
  const { data, seq, side } = assembled.data;

  const generator = getDocumentGenerator();
  let result;
  try {
    result = await generator.generate(data);
  } catch (e) {
    return { success: false, error: (e as Error).message, code: "GENERATION_FAILED" };
  }
  const { rendered, oscarDocId, oscarDocUrl } = result;

  const admin = createAdminClient() as AnyDb;
  const storagePath = `${input.orderId}/${input.docType}/${seq}-${rendered.fileName}`;
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, rendered.bytes, { contentType: rendered.mimeType, upsert: true });
  if (uploadErr) return { success: false, error: `Storage upload failed: ${uploadErr.message}`, code: "UPLOAD_FAILED" };

  const { data: docRow, error: insertErr } = await admin
    .from("order_documents")
    .insert({
      order_id: input.orderId,
      doc_type: input.docType,
      side,
      doc_number: data.docNumber,
      status: "draft",
      storage_path: storagePath,
      file_name: rendered.fileName,
      payload: data,
      oscar_doc_id: oscarDocId ?? null,
      oscar_doc_url: oscarDocUrl ?? null,
      generated_by: actor.portalUserId,
    })
    .select("id")
    .single();
  if (insertErr || !docRow) {
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]); // best-effort cleanup
    return { success: false, error: insertErr?.message ?? "Failed to record document", code: "INSERT_FAILED" };
  }

  const { data: signed } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  return {
    success: true,
    data: {
      id: docRow.id,
      orderId: input.orderId,
      docType: input.docType,
      docNumber: data.docNumber,
      fileName: rendered.fileName,
      storagePath,
      generator: generator.name,
      url: signed?.signedUrl ?? null,
    },
  };
}

/**
 * Delete a generated document: remove the stored file from the private bucket
 * and the `order_documents` row. Admin-only (enforced here on the actor, and
 * again at the action layer). Idempotent — a missing row is treated as success.
 * Uses the admin client (private bucket; row delete bypasses per-row RLS).
 */
export async function deleteDocument(db: DbClient, actor: ActorContext, documentId: string): Promise<ActionResult<{ id: string }>> {
  if (!isValidUUID(documentId)) return { success: false, error: "Invalid document id", code: "VALIDATION_ERROR" };
  if (!actor.isPlatformAdmin) return { success: false, error: "Only admins can delete documents", code: "FORBIDDEN" };
  const admin = createAdminClient() as AnyDb;
  const { data: row, error } = await admin.from("order_documents").select("id, storage_path").eq("id", documentId).maybeSingle();
  if (error) return { success: false, error: error.message, code: "FETCH_FAILED" };
  if (!row) return { success: true, data: { id: documentId } }; // already gone
  if (row.storage_path) {
    // Best-effort: a missing object must not block removing the row.
    await admin.storage.from(STORAGE_BUCKET).remove([row.storage_path as string]);
  }
  const { error: delErr } = await admin.from("order_documents").delete().eq("id", documentId);
  if (delErr) return { success: false, error: delErr.message, code: "DELETE_FAILED" };
  return { success: true, data: { id: documentId } };
}

/** Mint a fresh signed download URL for an already-generated document. */
export async function getDocumentUrl(db: DbClient, _actor: ActorContext, documentId: string): Promise<ActionResult<{ url: string; fileName: string | null }>> {
  if (!isValidUUID(documentId)) return { success: false, error: "Invalid document id", code: "VALIDATION_ERROR" };
  const c = db as AnyDb;
  const { data: row, error } = await c.from("order_documents").select("storage_path, file_name").eq("id", documentId).single();
  if (error || !row?.storage_path) return { success: false, error: error?.message ?? "Document not found", code: "NOT_FOUND" };
  const admin = createAdminClient() as AnyDb;
  const { data: signed, error: signErr } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(row.storage_path, 60 * 60 * 24 * 7);
  if (signErr || !signed?.signedUrl) return { success: false, error: signErr?.message ?? "Could not sign URL", code: "SIGN_FAILED" };
  return { success: true, data: { url: signed.signedUrl, fileName: row.file_name ?? null } };
}
