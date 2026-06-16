/**
 * Document generation service: assemble DocumentData from a deal, allocate a
 * document number, render the PDF, store it, and record a deal_documents row.
 *
 * Reads the deal via the passed `db` (respects RLS for UI callers); uses the
 * admin client for storage + the document-row insert (private bucket, signed-URL
 * downloads — no per-object storage RLS needed). Server-only.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult, ActorContext, DealSide, DocType, DealLineItem, DbClient } from "../types";
import { getDeal } from "./dealsService";
import { allocateCounter, buildDocNumber, docNumberScope } from "./numbering";
import { resolveVat } from "./vat";
import { amountInWords } from "./documents/amountInWords";
import { renderDocument, isRendererImplemented, DOC_TITLES } from "./documents";
import type { DocumentData, DocLineItem, PartyCard } from "./documents/types";

const STORAGE_BUCKET = "deal-documents";
const DEFAULT_ENTITY_CODE = "TIM";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export interface GenerateDocumentInput {
  dealId: string;
  docType: DocType;
  /** Defaults: sales_spec → sell, purchase_spec → buy. */
  side?: DealSide;
}

export interface GeneratedDocument {
  id: string;
  dealId: string;
  docType: DocType;
  docNumber: string;
  fileName: string;
  storagePath: string;
  /** Signed download URL (valid ~7 days). */
  url: string | null;
}

function pick<T = string>(row: Record<string, unknown> | null, keys: string[]): T | null {
  if (!row) return null;
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== "") return v as T;
  }
  return null;
}

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

function lineTotalCents(li: DealLineItem): number {
  if (li.lineTotalCents != null) return li.lineTotalCents;
  if (li.unitPriceCents == null) return 0;
  if (li.unit === "m3" && li.volumeM3 != null) return Math.round(li.unitPriceCents * li.volumeM3);
  if (li.unit === "piece" && li.pieces != null) {
    const pcs = parseFloat(li.pieces);
    return Number.isFinite(pcs) ? Math.round(li.unitPriceCents * pcs) : li.unitPriceCents;
  }
  return li.unitPriceCents;
}

function toDocLine(li: DealLineItem): DocLineItem {
  const descParts = [li.productName, li.woodSpecies, li.processing, li.quality, li.gradeNote].filter(Boolean);
  const dims = [li.thickness, li.width, li.length].filter(Boolean).join(" × ");
  return {
    lineNo: li.lineNo,
    description: descParts.join(", ") || "—",
    dimensions: dims,
    pieces: li.pieces,
    volumeM3: li.volumeM3,
    unit: li.unit,
    unitPriceCents: li.unitPriceCents,
    lineTotalCents: lineTotalCents(li),
  };
}

export async function generateDocument(
  db: DbClient,
  actor: ActorContext,
  input: GenerateDocumentInput
): Promise<ActionResult<GeneratedDocument>> {
  if (!isRendererImplemented(input.docType)) {
    return { success: false, error: `Document type "${input.docType}" is not available yet`, code: "NOT_IMPLEMENTED" };
  }

  const dealRes = await getDeal(db, actor, input.dealId);
  if (!dealRes.success) return dealRes as ActionResult<GeneratedDocument>;
  const deal = dealRes.data;

  const side: DealSide = input.side ?? (input.docType === "purchase_spec" ? "buy" : "sell");
  const admin = createAdminClient() as AnyDb;

  // Party cards: seller is always the trading entity; the counterparty depends on side.
  const sellerCard = await fetchPartyCard(admin, deal.seller.id);
  const buyerOrgId = side === "buy" ? deal.producer.id : deal.customer.id;
  const buyerCard = await fetchPartyCard(admin, buyerOrgId);

  const entityCode = (deal.seller.code || DEFAULT_ENTITY_CODE).toUpperCase();
  const docDate = new Date().toISOString();

  // Allocate the document number.
  let seq: number;
  try {
    seq = await allocateCounter(db, docNumberScope(input.docType, entityCode, docDate, deal.id));
  } catch (e) {
    return { success: false, error: (e as Error).message, code: "COUNTER_FAILED" };
  }
  const docNumber = buildDocNumber({ docType: input.docType, entityCode, date: docDate, seq });

  // Line items for this side.
  const items = (deal.lineItems ?? []).filter((li) => li.side === side);
  const docLines = items.map(toDocLine);
  const subtotalCents = docLines.reduce((s, l) => s + (l.lineTotalCents ?? 0), 0);
  const totalVolumeM3 = items.reduce((s, l) => s + (l.volumeM3 ?? 0), 0);

  const vat = resolveVat({ fromCountry: sellerCard.country, toCountry: buyerCard.country });
  const vatCents = Math.round((subtotalCents * vat.rate) / 100);
  const totalCents = subtotalCents + vatCents;

  const data: DocumentData = {
    docType: input.docType,
    docTitle: DOC_TITLES[input.docType],
    docNumber,
    docDate,
    dealCode: deal.code,
    currency: deal.currency,
    seller: sellerCard,
    buyer: buyerCard,
    externalRefs: (deal.externalRefs ?? [])
      .filter((r) => r.refType !== "other")
      .map((r) => ({ label: r.label || refLabel(r.refType), value: r.refValue })),
    incoterms: deal.incoterms ? `${deal.incoterms}${deal.incotermsPlace ? ` ${deal.incotermsPlace}` : ""}` : null,
    paymentTerms: deal.paymentTerms,
    deliveryTerms: deal.deliveryTerms,
    deliveryDeadline: deal.deliveryDeadline,
    advancePct: deal.advancePct,
    lineItems: docLines,
    totals: {
      totalVolumeM3,
      subtotalCents,
      vatRate: vat.rate,
      vatReference: vat.reference,
      vatCents,
      totalCents,
      amountInWords: amountInWords(totalCents, deal.currency),
    },
    notes: deal.notes,
  };

  const rendered = renderDocument(data);

  // Store the PDF (admin client → private bucket).
  const storagePath = `${deal.id}/${input.docType}/${seq}-${rendered.fileName}`;
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, rendered.bytes, { contentType: rendered.mimeType, upsert: true });
  if (uploadErr) {
    return { success: false, error: `Storage upload failed: ${uploadErr.message}`, code: "UPLOAD_FAILED" };
  }

  // Record the document row.
  const { data: docRow, error: insertErr } = await admin
    .from("deal_documents")
    .insert({
      deal_id: deal.id,
      doc_type: input.docType,
      side,
      doc_number: docNumber,
      status: "draft",
      storage_path: storagePath,
      file_name: rendered.fileName,
      payload: data,
      generated_by: actor.portalUserId,
    })
    .select("id")
    .single();

  if (insertErr || !docRow) {
    // Best-effort cleanup of the orphaned object.
    await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return { success: false, error: insertErr?.message ?? "Failed to record document", code: "INSERT_FAILED" };
  }

  const { data: signed } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  return {
    success: true,
    data: {
      id: docRow.id,
      dealId: deal.id,
      docType: input.docType,
      docNumber,
      fileName: rendered.fileName,
      storagePath,
      url: signed?.signedUrl ?? null,
    },
  };
}

/** Mint a fresh signed download URL for an already-generated document. */
export async function getDocumentUrl(
  db: DbClient,
  _actor: ActorContext,
  documentId: string
): Promise<ActionResult<{ url: string; fileName: string | null }>> {
  const c = db as AnyDb;
  const { data: row, error } = await c
    .from("deal_documents")
    .select("storage_path, file_name")
    .eq("id", documentId)
    .single();
  if (error || !row?.storage_path) {
    return { success: false, error: error?.message ?? "Document not found", code: "NOT_FOUND" };
  }
  const admin = createAdminClient() as AnyDb;
  const { data: signed, error: signErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(row.storage_path, 60 * 60 * 24 * 7);
  if (signErr || !signed?.signedUrl) {
    return { success: false, error: signErr?.message ?? "Could not sign URL", code: "SIGN_FAILED" };
  }
  return { success: true, data: { url: signed.signedUrl, fileName: row.file_name ?? null } };
}

function refLabel(refType: string): string {
  switch (refType) {
    case "client_project": return "Client project";
    case "client_job": return "Client job";
    case "client_po": return "Client PO";
    default: return "Ref";
  }
}
