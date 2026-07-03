/**
 * D2 (§8.2) · Document-type registry — the SINGLE SOURCE OF TRUTH for the set of
 * document types, their UI labels, PDF titles and direction affinity.
 *
 * Every list/dropdown/validation of doc types derives from here (MCP tool enum,
 * templates editor, deal document panel, gate config in E1). The DocType *union*
 * still lives in dealModel.ts (the type); this file owns the runtime VALUES and
 * metadata. A compile-time guard (`_complete` below) fails the build if the union
 * and this registry drift.
 *
 * ⚠️ ADDING OR RENAMING A KEY requires migrating BOTH database CHECK constraints
 * that enumerate the 7 keys:
 *   - order_documents.doc_type      → supabase/migrations/20260616000001_orders_universal.sql:88
 *   - document_templates.doc_type   → supabase/migrations/20260701000017_document_templates.sql:16
 * V1 keeps exactly the existing 7 keys. "Quotation" is NOT a new key — it is D1's
 * `doc_state` on `sales_spec` (see titleFor / DocState in dealModel.ts).
 */
import type { DocType, DocState, DealKind } from "../dealModel";

/** Which leg a document naturally belongs to (§8.2). `both` = shared across sides. */
export type DocAffinity = "sell" | "buy" | "both";

export interface DocTypeEntry {
  key: DocType;
  /** Human UI label (pickers, panels). */
  label: string;
  /** Default PDF heading (sales_spec is overridden by doc_state — see titleFor). */
  title: string;
  /** Direction affinity — drives the D3 expected-set + generation gating. */
  affinity: DocAffinity;
}

/**
 * The authoritative, ORDERED list. Order flows to every picker. §8.2 names the
 * buy-side order "Purchase order" though its key stays `purchase_spec`.
 */
const ENTRIES = [
  { key: "sales_spec", label: "Sales specification", title: "SALES SPECIFICATION", affinity: "sell" },
  { key: "purchase_spec", label: "Purchase order", title: "PURCHASE ORDER", affinity: "buy" },
  { key: "contract", label: "Sales contract", title: "SALES CONTRACT", affinity: "sell" },
  { key: "proforma_invoice", label: "Proforma / advance invoice", title: "PROFORMA / ADVANCE INVOICE", affinity: "both" },
  { key: "invoice", label: "Invoice", title: "INVOICE", affinity: "both" },
  { key: "packing_list", label: "Packing list", title: "PACKING LIST", affinity: "both" },
  { key: "cmr", label: "CMR", title: "CMR", affinity: "both" },
] as const satisfies readonly DocTypeEntry[];

// Compile-time completeness: build fails if the DocType union gains a key that is
// not represented above (keeps the registry and the type provably in sync).
const _complete: Exclude<DocType, (typeof ENTRIES)[number]["key"]> extends never ? true : never = true;
void _complete;

/** Ordered list of all doc-type keys (replaces every hardcoded string array). */
export const DOC_TYPES: DocType[] = ENTRIES.map((e) => e.key);

/** key → entry. */
export const DOC_TYPE_REGISTRY = Object.fromEntries(ENTRIES.map((e) => [e.key, e])) as Record<DocType, DocTypeEntry>;

/** key → UI label. */
export const DOC_TYPE_LABELS = Object.fromEntries(ENTRIES.map((e) => [e.key, e.label])) as Record<DocType, string>;

/** key → default PDF title (use titleFor() when doc_state applies). */
export const DOC_TITLES = Object.fromEntries(ENTRIES.map((e) => [e.key, e.title])) as Record<DocType, string>;

/** Direction affinity of a doc type. */
export function affinityOf(docType: DocType): DocAffinity {
  return DOC_TYPE_REGISTRY[docType]?.affinity ?? "both";
}

/**
 * D1 · the PDF heading for a document, accounting for the quotation→firm state of
 * the spec. `sales_spec` is the "Quotation → Order specification" document (§8.2):
 * quotation → "QUOTATION", firm → "ORDER SPECIFICATION"; any other type (or a
 * null state) uses its registry title.
 */
export function titleFor(docType: DocType, docState?: DocState | null): string {
  if (docType === "sales_spec") {
    if (docState === "quotation") return "QUOTATION";
    if (docState === "firm") return "ORDER SPECIFICATION";
  }
  return DOC_TITLES[docType];
}

/** Is a deal a buy leg (its documents are the buy side)? */
function isBuyLegKind(dealKind: string): dealKind is DealKind {
  return dealKind === "purchase_only";
}

/** The direction a deal's own documents face, from the deal KIND (house perspective). */
export function dealDocDirection(dealKind: string): "sell" | "buy" {
  return isBuyLegKind(dealKind) ? "buy" : "sell";
}

/**
 * D3 (§8.2) · the expected document set for a deal, by its direction. A sell deal
 * expects the sell + shared docs; a buy leg expects the buy + shared docs. Purely
 * informational (§8.1: the stage never gates which documents exist).
 */
export function expectedDocsForDealKind(dealKind: string): DocType[] {
  const dir = dealDocDirection(dealKind);
  return DOC_TYPES.filter((t) => {
    const aff = affinityOf(t);
    return aff === "both" || aff === dir;
  });
}

/**
 * D3 · generation affinity gate. A document may be GENERATED on a deal only when
 * its affinity matches the deal's direction (or is shared). A buy-affinity doc
 * (purchase order) generated on a sell deal is rejected with a pointer to the
 * other leg — but UPLOADS are never gated (§9.2: a Client uploads their own PO
 * onto a sell deal).
 */
export function canGenerateOnDeal(
  docType: DocType,
  dealKind: string,
): { ok: true } | { ok: false; otherLeg: "buy" | "sell"; reason: string } {
  const aff = affinityOf(docType);
  if (aff === "both") return { ok: true };
  const dir = dealDocDirection(dealKind);
  if (aff === dir) return { ok: true };
  const label = DOC_TYPE_LABELS[docType];
  const otherLeg = aff; // the leg this doc belongs to (sell|buy)
  return {
    ok: false,
    otherLeg,
    reason: `A ${label} belongs to the ${otherLeg} deal. Generate it on this chain's ${otherLeg} leg (you can still upload one here).`,
  };
}
