"use server";

/**
 * Document-template CRUD + import/preview server actions (E6).
 *
 * Templates are GLOBAL Handlebars sources (document_templates) merged against
 * DocumentData at generation time. Access is gated on platform-admin OR the
 * `documents.view` module (enabled for internal orgs by the E6 migration).
 * DB access uses the service-role admin client (templates are non-secret and
 * global); the RLS write policy is platform-admin as defence-in-depth.
 */
import mammoth from "mammoth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import { mergeTemplate } from "@/features/orders/services/documents/templateMerge";
import { DOC_TITLES } from "@/features/orders/services/documents/types";
import type { DocumentData } from "@/features/orders/services/documents/types";
import type { DocType } from "@/features/orders/services/dealModel";
import type {
  ActionResult,
  DocumentTemplate,
  DocumentTemplateSummary,
  ImportDocxResult,
  PreviewTemplateInput,
  SaveTemplateInput,
} from "../types";

const DOC_TYPES: DocType[] = [
  "sales_spec",
  "purchase_spec",
  "contract",
  "proforma_invoice",
  "invoice",
  "packing_list",
  "cmr",
];

/** READ gate: platform admin OR the documents.view module. Returns the session on ok. */
async function requireDocumentsAccess(): Promise<
  { ok: true; portalUserId: string } | { ok: false; result: ActionResult<never> }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, result: { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" } };
  }
  if (isAdmin(session)) {
    return { ok: true, portalUserId: session.portalUserId ?? "" };
  }
  const orgId = session.currentOrganizationId || session.organisationId;
  if (session.portalUserId && orgId) {
    const modules = await getUserEnabledModules(session.portalUserId, orgId);
    if (modules.has("documents.view")) {
      return { ok: true, portalUserId: session.portalUserId };
    }
  }
  return { ok: false, result: { success: false, error: "Permission denied", code: "FORBIDDEN" } };
}

/**
 * WRITE gate: platform admin ONLY. Templates are GLOBAL and platform-wide, so a
 * mutation affects every org's generated documents. Writes go through the
 * service-role client (RLS-bypassing), so the DB's platform-admin write policy
 * is NOT a backstop here — this gate is the sole guard. A `documents.view`
 * module holder may read/preview/import (READ gate) but must NOT be able to
 * create/edit/delete the shared templates.
 */
async function requireDocumentsAdmin(): Promise<
  { ok: true; portalUserId: string } | { ok: false; result: ActionResult<never> }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, result: { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" } };
  }
  if (!isAdmin(session)) {
    return { ok: false, result: { success: false, error: "Only an admin can edit document templates", code: "FORBIDDEN" } };
  }
  return { ok: true, portalUserId: session.portalUserId ?? "" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function mapRow(r: Row): DocumentTemplate {
  return {
    id: r.id,
    docType: r.doc_type,
    name: r.name,
    html: r.html,
    isDefault: r.is_default,
    isActive: r.is_active,
    version: r.version,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    contentFormat: (r.content_format ?? "html") as DocumentTemplate["contentFormat"],
    docJson: (r.doc_json ?? null) as DocumentTemplate["docJson"],
    pageSettings: (r.page_settings ?? null) as DocumentTemplate["pageSettings"],
    logoPath: r.logo_path ?? null,
  };
}

function mapSummary(r: Row): DocumentTemplateSummary {
  return {
    id: r.id,
    docType: r.doc_type,
    name: r.name,
    isDefault: r.is_default,
    isActive: r.is_active,
    version: r.version,
    updatedAt: r.updated_at,
    contentFormat: (r.content_format ?? "html") as DocumentTemplateSummary["contentFormat"],
  };
}

/** List all templates (summaries, no html body). */
export async function listTemplates(): Promise<ActionResult<DocumentTemplateSummary[]>> {
  const gate = await requireDocumentsAccess();
  if (!gate.ok) return gate.result;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("document_templates")
    .select("id, doc_type, name, is_default, is_active, version, updated_at, content_format")
    .order("doc_type", { ascending: true })
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) return { success: false, error: "Failed to list templates", code: "QUERY_FAILED" };
  return { success: true, data: (data as Row[]).map(mapSummary) };
}

/** Get a single template (full html). */
export async function getTemplate(id: string): Promise<ActionResult<DocumentTemplate>> {
  const gate = await requireDocumentsAccess();
  if (!gate.ok) return gate.result;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from("document_templates").select("*").eq("id", id).maybeSingle();

  if (error) return { success: false, error: "Failed to load template", code: "QUERY_FAILED" };
  if (!data) return { success: false, error: "Template not found", code: "NOT_FOUND" };
  return { success: true, data: mapRow(data as Row) };
}

/**
 * Create (no id) or update (id) a template. When isDefault is set, all OTHER
 * templates of the same doc_type are unset first (the partial unique index
 * allows at most one default per type), then this row is written as default.
 */
export async function saveTemplate(input: SaveTemplateInput): Promise<ActionResult<DocumentTemplate>> {
  const gate = await requireDocumentsAdmin();
  if (!gate.ok) return gate.result;

  if (!DOC_TYPES.includes(input.docType)) {
    return { success: false, error: "Invalid document type", code: "VALIDATION" };
  }
  if (!input.name?.trim()) {
    return { success: false, error: "Name is required", code: "VALIDATION" };
  }
  if (typeof input.html !== "string" || !input.html.trim()) {
    return { success: false, error: "Template HTML is required", code: "VALIDATION" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Unset other defaults for this type BEFORE writing this one as default so the
  // partial unique index (one default per doc_type) never collides.
  if (input.isDefault) {
    const clear = admin.from("document_templates").update({ is_default: false }).eq("doc_type", input.docType);
    const { error: clearErr } = input.id ? await clear.neq("id", input.id) : await clear;
    if (clearErr) return { success: false, error: "Failed to update defaults", code: "QUERY_FAILED" };
  }

  if (input.id) {
    const { data, error } = await admin
      .from("document_templates")
      .update({
        doc_type: input.docType,
        name: input.name.trim(),
        html: input.html,
        is_default: input.isDefault,
        is_active: input.isActive,
      })
      .eq("id", input.id)
      .select("*")
      .maybeSingle();

    if (error) return { success: false, error: "Failed to update template", code: "QUERY_FAILED" };
    if (!data) return { success: false, error: "Template not found", code: "NOT_FOUND" };
    return { success: true, data: mapRow(data as Row) };
  }

  const { data, error } = await admin
    .from("document_templates")
    .insert({
      doc_type: input.docType,
      name: input.name.trim(),
      html: input.html,
      is_default: input.isDefault,
      is_active: input.isActive,
      created_by: gate.portalUserId || null,
    })
    .select("*")
    .maybeSingle();

  if (error) return { success: false, error: "Failed to create template", code: "QUERY_FAILED" };
  return { success: true, data: mapRow(data as Row) };
}

/** Delete a template. */
export async function deleteTemplate(id: string): Promise<ActionResult<{ id: string }>> {
  const gate = await requireDocumentsAdmin();
  if (!gate.ok) return gate.result;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { error } = await admin.from("document_templates").delete().eq("id", id);

  if (error) return { success: false, error: "Failed to delete template", code: "QUERY_FAILED" };
  return { success: true, data: { id } };
}

/** Make a template the default for its doc_type (unsets the previous default). */
export async function setDefaultTemplate(id: string): Promise<ActionResult<DocumentTemplate>> {
  const gate = await requireDocumentsAdmin();
  if (!gate.ok) return gate.result;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: row, error: rowErr } = await admin
    .from("document_templates")
    .select("doc_type")
    .eq("id", id)
    .maybeSingle();
  if (rowErr) return { success: false, error: "Failed to load template", code: "QUERY_FAILED" };
  if (!row) return { success: false, error: "Template not found", code: "NOT_FOUND" };

  const { error: clearErr } = await admin
    .from("document_templates")
    .update({ is_default: false })
    .eq("doc_type", (row as Row).doc_type)
    .neq("id", id);
  if (clearErr) return { success: false, error: "Failed to update defaults", code: "QUERY_FAILED" };

  const { data, error } = await admin
    .from("document_templates")
    .update({ is_default: true, is_active: true })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return { success: false, error: "Failed to set default", code: "QUERY_FAILED" };
  if (!data) return { success: false, error: "Template not found", code: "NOT_FOUND" };
  return { success: true, data: mapRow(data as Row) };
}

/**
 * Import a .docx upload and convert it to HTML via mammoth. Does NOT save — the
 * editor decides what to do with the returned HTML.
 */
export async function importDocxTemplate(formData: FormData): Promise<ActionResult<ImportDocxResult>> {
  const gate = await requireDocumentsAccess();
  if (!gate.ok) return gate.result;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "No file provided", code: "VALIDATION" };
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return { success: false, error: "Only .docx files are supported", code: "VALIDATION" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.convertToHtml({ buffer });
    return {
      success: true,
      data: { html: result.value, messages: result.messages.map((m) => m.message) },
    };
  } catch {
    return { success: false, error: "Failed to convert document", code: "CONVERT_FAILED" };
  }
}

/**
 * Merge a template against a representative sample DocumentData for the given
 * doc type and return the rendered HTML — for the editor's live preview.
 */
export async function previewTemplate(input: PreviewTemplateInput): Promise<ActionResult<{ html: string }>> {
  const gate = await requireDocumentsAccess();
  if (!gate.ok) return gate.result;

  try {
    const html = mergeTemplate(input.html, buildSampleDocumentData(input.docType));
    return { success: true, data: { html } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Template render failed";
    return { success: false, error: msg, code: "RENDER_FAILED" };
  }
}

/** Representative sample used by previewTemplate so the editor shows live output. */
function buildSampleDocumentData(docType: DocType): DocumentData {
  const isPurchase = docType === "purchase_spec";
  return {
    docType,
    docTitle: DOC_TITLES[docType],
    docNumber: "No. 1",
    docDate: new Date().toISOString(),
    dealCode: "TIMSOM001",
    currency: "EUR",
    seller: {
      name: "Timber World SIA",
      regNo: "40000000000",
      vatNo: "LV40000000000",
      address: "Brivibas iela 1, Riga, LV-1010, Latvia",
      country: "Latvia",
      email: "sales@timberworld.lv",
      phone: "+371 2000 0000",
      bankName: "Swedbank AS",
      bankAccount: "LV00HABA0000000000000",
      bankSwift: "HABALV22",
    },
    buyer: {
      name: isPurchase ? "Wood ART Ltd" : "DDC Distribution Ltd",
      regNo: "GB123456789",
      vatNo: "GB123456789",
      address: "10 Timber Yard, London, EC1A 1BB, United Kingdom",
      country: "United Kingdom",
      email: "orders@ddc.co.uk",
      phone: "+44 20 0000 0000",
      bankName: null,
      bankAccount: null,
      bankSwift: null,
    },
    externalRefs: [
      { label: "Client ref", value: "PO-2026-0042" },
      { label: "Contract", value: "TW/2026/1" },
    ],
    incoterms: "FCA Riga (Incoterms 2020)",
    paymentTerms: "30% advance, balance before loading",
    deliveryTerms: "By truck, full load",
    deliveryDeadline: "2026-08-15",
    advancePct: 30,
    lineItems: [
      {
        lineNo: 1,
        description: "Oak board, KD 8-10%, AB grade, planed",
        dimensions: "27 × 150 × 2000",
        pieces: "120",
        volumeM3: 0.972,
        unit: "m3",
        unitPriceCents: 68000,
        lineTotalCents: 66096,
      },
      {
        lineNo: 2,
        description: "Pine plank, KD, C grade",
        dimensions: "50 × 200 × 3000",
        pieces: "40",
        volumeM3: 1.2,
        unit: "m3",
        unitPriceCents: 32000,
        lineTotalCents: 38400,
      },
      {
        lineNo: 3,
        description: "Birch plywood, WBP, 18 mm",
        dimensions: "18 × 1250 × 2500",
        pieces: "25",
        volumeM3: 1.406,
        unit: "m3",
        unitPriceCents: 45000,
        lineTotalCents: 63270,
      },
    ],
    totals: {
      totalVolumeM3: 3.578,
      subtotalCents: 167766,
      vatRate: 21,
      vatReference: null,
      vatCents: 35231,
      totalCents: 202997,
      amountInWords: "two thousand and twenty-nine euros and 97 cents",
    },
    notes: "Goods remain the property of the seller until full payment is received.",
  };
}
