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
import { sanitizeStorageFileName } from "@/lib/utils/storage";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { ActorContext, DealSide, DocType, DocState, DbClient } from "./dealModel";
import { getOrderDeal } from "./orderDeals";
import { allocateCounter, buildDocNumber, docNumberScope } from "./numbering";
import { buildDocumentData, defaultSideFor } from "./documents/assemble";
import type { DocumentData, PartyCard } from "./documents/types";
import { canGenerateOnDeal } from "./documents/registry";
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
  /** D1: quotation|firm for the sales_spec. A fresh sales_spec generate defaults to
   *  'quotation'; other types stay null. */
  docState?: DocState | null;
  /** D1 regenerate-in-place: reuse this existing doc number (skip counter alloc). */
  reuseDocNumber?: string;
}

export interface AssembledDocument {
  data: DocumentData;
  seq: number;
  side: DealSide;
  /** The resolved quotation|firm state stored with the row (null for non-specs). */
  docState: DocState | null;
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
    // G3: the org's DEFAULT signee (a per-deal override is overlaid by the caller).
    signeeName: pick(merged, ["default_signee_name"]),
    signeeRole: pick(merged, ["default_signee_role"]),
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

  // D3 (§8.2/§8.1) · generation affinity: a document may be GENERATED only on the
  // leg it belongs to (a purchase order on the buy deal, a sales spec on the sell
  // deal); shared docs generate anywhere. Checked BEFORE counter allocation so a
  // rejected generate never burns a doc number. Uploads use a different path and
  // are never gated (§9.2: a Client uploads their own purchase order onto a sell
  // deal). This gate is intentionally on the deal's KIND (its own direction), not
  // the viewer.
  const gate = canGenerateOnDeal(input.docType, deal.dealKind);
  if (!gate.ok) return { success: false, error: gate.reason, code: "WRONG_LEG" };

  const side: DealSide = input.side ?? defaultSideFor(input.docType);

  // L3 · a deal may be HELD with one party unset (a leg while still shopping),
  // but a document needs BOTH parties for its seller/buyer blocks. Fail clearly
  // rather than emit a PDF with a blank party card. (Tiny early guard — the rest
  // of assembly is unchanged.)
  const effectiveBuyerId = side === "buy"
    ? (deal.producer.id ?? deal.buyer.id ?? deal.customer.id)
    : (deal.buyer.id ?? deal.customer.id);
  if (!deal.seller.id || !effectiveBuyerId) {
    return {
      success: false,
      error: "This deal is missing a party (customer / trader). Set both parties before generating documents.",
      code: "MISSING_PARTY",
    };
  }

  const admin = createAdminClient() as AnyDb;

  // A4 (§8.2): a document's parties are the deal's bilateral seller/buyer.
  // Buy-side docs (purchase_spec): on a spawned buy leg `producer` is NULL and the
  // house is the buyer, so fall through producer → the `buyer` embed (the house) —
  // this fixes the empty buyer card on buy legs. On a LEGACY conflated buy_sell row
  // the producer is the sourcing party, so keep it as the purchase doc's buyer (no
  // regression). Sell-side docs use the bilateral buyer (== customer on legacy rows).
  const sellerCard = await fetchPartyCard(admin, deal.seller.id);
  const buyerOrgId = side === "buy"
    ? (deal.producer.id ?? deal.buyer.id ?? deal.customer.id)
    : (deal.buyer.id ?? deal.customer.id);
  const buyerCard = await fetchPartyCard(admin, buyerOrgId);

  // G3 · signee resolves deal-override → org default (the card already holds the org
  // default). The override is per SIDE of the deal (seller_* / buyer_*).
  if (deal.sellerSigneeName != null) sellerCard.signeeName = deal.sellerSigneeName;
  if (deal.sellerSigneeRole != null) sellerCard.signeeRole = deal.sellerSigneeRole;
  if (deal.buyerSigneeName != null) buyerCard.signeeName = deal.buyerSigneeName;
  if (deal.buyerSigneeRole != null) buyerCard.signeeRole = deal.buyerSigneeRole;

  const entityCode = (deal.seller.code || DEFAULT_ENTITY_CODE).toUpperCase();
  const docDate = new Date().toISOString();

  // D1: the sales_spec is the "Quotation → Order specification" — a fresh generate
  // is a non-binding quotation; other types carry no doc_state.
  const docState: DocState | null = input.docState ?? (input.docType === "sales_spec" ? "quotation" : null);

  // D1 regenerate-in-place (firming) reuses the existing number; a fresh generate
  // allocates the next sequence.
  let seq = 0;
  let docNumber: string;
  if (input.reuseDocNumber) {
    docNumber = input.reuseDocNumber;
  } else {
    try {
      seq = await allocateCounter(db, docNumberScope(input.docType, entityCode, docDate, deal.id));
    } catch (e) {
      return { success: false, error: (e as Error).message, code: "COUNTER_FAILED" };
    }
    docNumber = buildDocNumber({ docType: input.docType, entityCode, date: docDate, seq });
  }

  const data = buildDocumentData({
    docType: input.docType,
    side,
    docState,
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
    // A4 (§2.1/§8.2): assemble from the deal's OWN lines — this deal-aware scoping
    // lives here because buildDocumentData is pure (no dealKind). A single-sided leg
    // (a sell leg, or a purchase_only BUY leg) holds only its own lines, all stored
    // side='sell', so assemble them ALL — this is the A4 fix (the old
    // side===docSide filter wrongly dropped a buy leg's own lines). A LEGACY
    // conflated buy_sell row still carries BOTH sides on one order, so there we pick
    // the doc's own side: keeps supplier buy lines OUT of a sell document (no leak,
    // since the doc path bypasses projectDealView) and sell lines out of a purchase
    // document — exactly the pre-A4 behaviour for those residual rows.
    lineItems: deal.dealKind === "buy_sell"
      ? deal.lineItems.filter((li) => li.side === side)
      : deal.lineItems,
  });

  return { success: true, data: { data, seq, side, docState } };
}

/**
 * Generate (or, for Oscar, request) a document for a deal, store the file and
 * record an `order_documents` row. Returns the row id + a signed download URL.
 */
export async function generateDocument(db: DbClient, actor: ActorContext, input: DocumentRequest): Promise<ActionResult<GeneratedDocument>> {
  const assembled = await assembleDocumentData(db, actor, input);
  if (!assembled.success) return assembled as ActionResult<GeneratedDocument>;
  const { data, seq, side, docState } = assembled.data;

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
      doc_state: docState, // D1: quotation on a fresh sales_spec; null otherwise
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
 * D1 (§8.2) · Regenerate a document IN PLACE, transitioning its doc_state.
 *
 * The "Quotation → Order specification" is one document in two states: firming it
 * keeps the SAME row + SAME doc_number, re-renders the PDF (now titled ORDER
 * SPECIFICATION off doc_state), overwrites the stored file at the existing path,
 * and stamps doc_state='firm' + firmed_at/by. Only the sales_spec has states.
 * Idempotent target: re-firming a firm spec just re-renders and re-stamps.
 */
export async function regenerateDocument(
  db: DbClient,
  actor: ActorContext,
  input: { documentId: string; docState: DocState },
): Promise<ActionResult<GeneratedDocument>> {
  if (!isValidUUID(input.documentId)) return { success: false, error: "Invalid document id", code: "VALIDATION_ERROR" };
  const admin = createAdminClient() as AnyDb;
  const { data: row, error: rowErr } = await admin
    .from("order_documents")
    .select("id, order_id, doc_type, doc_number, storage_path, side, doc_state")
    .eq("id", input.documentId)
    .maybeSingle();
  if (rowErr) return { success: false, error: rowErr.message, code: "FETCH_FAILED" };
  if (!row) return { success: false, error: "Document not found", code: "NOT_FOUND" };
  if (row.doc_type !== "sales_spec") {
    return { success: false, error: "Only the sales specification has quotation/firm states", code: "NOT_APPLICABLE" };
  }
  if (!row.storage_path) {
    return { success: false, error: "This document has no stored file to replace", code: "NO_FILE" };
  }

  // Re-assemble with the SAME number + the new state (RLS-scoped read via `db`).
  const assembled = await assembleDocumentData(db, actor, {
    orderId: row.order_id as string,
    docType: "sales_spec",
    side: (row.side as DealSide) ?? "sell",
    docState: input.docState,
    reuseDocNumber: row.doc_number as string,
  });
  if (!assembled.success) return assembled as ActionResult<GeneratedDocument>;
  const { data } = assembled.data;

  const generator = getDocumentGenerator();
  let result;
  try {
    result = await generator.generate(data);
  } catch (e) {
    return { success: false, error: (e as Error).message, code: "GENERATION_FAILED" };
  }
  const { rendered, oscarDocId, oscarDocUrl } = result;

  const storagePath = row.storage_path as string; // reuse the SAME path (same number)
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, rendered.bytes, { contentType: rendered.mimeType, upsert: true });
  if (uploadErr) return { success: false, error: `Storage upload failed: ${uploadErr.message}`, code: "UPLOAD_FAILED" };

  const patch: Record<string, unknown> = {
    doc_state: input.docState,
    file_name: rendered.fileName,
    payload: data,
    oscar_doc_id: oscarDocId ?? null,
    oscar_doc_url: oscarDocUrl ?? null,
  };
  if (input.docState === "firm") {
    patch.firmed_at = new Date().toISOString();
    patch.firmed_by = actor.portalUserId;
  }
  const { error: updErr } = await admin.from("order_documents").update(patch).eq("id", input.documentId);
  if (updErr) return { success: false, error: updErr.message, code: "UPDATE_FAILED" };

  const { data: signed } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  return {
    success: true,
    data: {
      id: input.documentId,
      orderId: row.order_id as string,
      docType: "sales_spec",
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

// ── N2 (b) · Signed versions of a generated document ───────────────────────────
// A generated order_documents row can carry a counterparty-SIGNED PDF uploaded
// alongside the system-generated one (Nils: "esošajiem uzģenerētajiem dokumentiem
// jāspēj uploadot parakstīto versiju."). Stored in the SAME private bucket under a
// signed/ prefix; recorded on signed_storage_path/file_name/uploaded_at/by.
// Upload doubles as replace (a fresh upload overwrites the previous signed file).
// Caller enforces permission (deal_terms-editable OR admin).

export interface SignedUploadInput {
  documentId: string;
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}

/** Store (or replace) the signed version of a generated document. */
export async function uploadSignedDocument(_db: DbClient, actor: ActorContext, input: SignedUploadInput): Promise<ActionResult<{ id: string; url: string | null }>> {
  if (!isValidUUID(input.documentId)) return { success: false, error: "Invalid document id", code: "VALIDATION_ERROR" };
  const admin = createAdminClient() as AnyDb;
  const { data: row, error } = await admin
    .from("order_documents")
    .select("id, order_id, doc_type, signed_storage_path")
    .eq("id", input.documentId)
    .maybeSingle();
  if (error) return { success: false, error: error.message, code: "FETCH_FAILED" };
  if (!row) return { success: false, error: "Document not found", code: "NOT_FOUND" };

  const safeName = sanitizeStorageFileName(input.fileName) || "signed.pdf";
  const storagePath = `${row.order_id}/${row.doc_type}/signed/${input.documentId}-${safeName}`;
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.bytes, { contentType: input.mimeType || "application/octet-stream", upsert: true });
  if (uploadErr) return { success: false, error: `Storage upload failed: ${uploadErr.message}`, code: "UPLOAD_FAILED" };

  // Replace: remove a superseded signed file left at a DIFFERENT path (the file
  // name changed) so no orphan lingers. Same-path uploads were upserted above.
  const prev = row.signed_storage_path as string | null;
  if (prev && prev !== storagePath) {
    await admin.storage.from(STORAGE_BUCKET).remove([prev]);
  }

  const { error: updErr } = await admin
    .from("order_documents")
    .update({
      signed_storage_path: storagePath,
      signed_file_name: input.fileName,
      signed_uploaded_at: new Date().toISOString(),
      signed_uploaded_by: actor.portalUserId,
    })
    .eq("id", input.documentId);
  if (updErr) {
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]); // best-effort cleanup
    return { success: false, error: updErr.message, code: "UPDATE_FAILED" };
  }

  const { data: signed } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  return { success: true, data: { id: input.documentId, url: signed?.signedUrl ?? null } };
}

/** Mint a fresh signed download URL for a document's uploaded signed version. */
export async function getSignedDocumentUrl(db: DbClient, _actor: ActorContext, documentId: string): Promise<ActionResult<{ url: string; fileName: string | null }>> {
  if (!isValidUUID(documentId)) return { success: false, error: "Invalid document id", code: "VALIDATION_ERROR" };
  const c = db as AnyDb;
  const { data: row, error } = await c.from("order_documents").select("signed_storage_path, signed_file_name").eq("id", documentId).single();
  if (error || !row?.signed_storage_path) return { success: false, error: error?.message ?? "No signed version uploaded", code: "NOT_FOUND" };
  const admin = createAdminClient() as AnyDb;
  const { data: signed, error: signErr } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(row.signed_storage_path, 60 * 60 * 24 * 7);
  if (signErr || !signed?.signedUrl) return { success: false, error: signErr?.message ?? "Could not sign URL", code: "SIGN_FAILED" };
  return { success: true, data: { url: signed.signedUrl, fileName: row.signed_file_name ?? null } };
}

/** Delete a document's uploaded signed version (file + the signed_* columns).
 *  Leaves the generated document row itself intact. Idempotent. Caller-gated. */
export async function deleteSignedDocument(_db: DbClient, _actor: ActorContext, documentId: string): Promise<ActionResult<{ id: string }>> {
  if (!isValidUUID(documentId)) return { success: false, error: "Invalid document id", code: "VALIDATION_ERROR" };
  const admin = createAdminClient() as AnyDb;
  const { data: row, error } = await admin.from("order_documents").select("id, signed_storage_path").eq("id", documentId).maybeSingle();
  if (error) return { success: false, error: error.message, code: "FETCH_FAILED" };
  if (!row) return { success: true, data: { id: documentId } }; // already gone
  if (row.signed_storage_path) {
    await admin.storage.from(STORAGE_BUCKET).remove([row.signed_storage_path as string]); // best-effort
  }
  const { error: updErr } = await admin
    .from("order_documents")
    .update({ signed_storage_path: null, signed_file_name: null, signed_uploaded_at: null, signed_uploaded_by: null })
    .eq("id", documentId);
  if (updErr) return { success: false, error: updErr.message, code: "UPDATE_FAILED" };
  return { success: true, data: { id: documentId } };
}
