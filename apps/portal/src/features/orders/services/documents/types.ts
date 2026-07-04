/**
 * Document data — the validated, render-ready shape a document is built from.
 * Assembled from a deal (order); consumed by the per-type renderers. Keeping this
 * separate from DB rows is what lets the same renderer be unit-tested from a
 * fixture with no database. Salvaged from features/deals during E2.4; the full
 * generation port + data assembly that feed these is built in E3.
 */
import type { DocType, DocState } from "../dealModel";

export interface PartyCard {
  name: string;
  regNo?: string | null;
  vatNo?: string | null;
  address?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankSwift?: string | null;
  /** G3 · the person who signs (signature block). Resolved deal-override → org default. */
  signeeName?: string | null;
  signeeRole?: string | null;
}

export interface DocLineItem {
  lineNo: number;
  description: string; // assembled: product, species, processing, quality, grade note
  dimensions: string; // "T×W×L" assembled from thickness/width/length
  pieces: string | null;
  volumeM3: number | null;
  unit: string;
  unitPriceCents: number | null;
  lineTotalCents: number | null;
  /**
   * S2 · Per-line CUSTOM catalog field values (field_key → display string), so a
   * document can place dynamic `{{lookup attr "<field_key>"}}` columns for any
   * catalog attribute (glulam extras, coatings, …) — previously impossible, since
   * order lines carried only the 6 classic attribute option-ids. Populated by the
   * DB assembler (orderDocuments.assembleDocumentData); the pure assembler only
   * copies it through. Reserved keys: `_packaging`, `_piecesPerPackage`. Always an
   * object (may be empty).
   */
  attr: Record<string, string>;
}

export interface DocTotals {
  totalVolumeM3: number;
  subtotalCents: number;
  vatRate: number;
  vatReference: string | null;
  vatCents: number;
  totalCents: number;
  amountInWords: string;
}

export interface DocumentData {
  docType: DocType;
  docTitle: string;
  /** D1 (§8.2): quotation|firm for the sales_spec; null for other types. Drives the
   *  heading (via titleFor) so ONE spec document reads QUOTATION then ORDER SPECIFICATION. */
  docState: DocState | null;
  docNumber: string;
  /** ISO date string for the document. */
  docDate: string;
  dealCode: string;
  currency: string;
  seller: PartyCard;
  buyer: PartyCard;
  externalRefs: { label: string; value: string }[];
  /** N3 · the deal's canonical party order numbers, resolved from externalRefs, so
   *  templates can place them as dedicated merge fields (they also appear in the
   *  generic externalRefs block). null when not set on the deal. */
  customerOrderNo: string | null;
  supplierOrderNo: string | null;
  /** S2 · the house user who GENERATED the document (name/email/phone). Populated
   *  HOUSE-ONLY (a counterparty / service-agent generate resolves to null) so a
   *  counterparty document can never leak the generating person's identity. */
  issuer: { name: string; email: string | null; phone: string | null } | null;
  /** S2 · the deal's spine chain identity (SP-###), resolved from the spine;
   *  null when the deal has no spine. */
  spineCode: string | null;
  incoterms: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  deliveryDeadline: string | null;
  advancePct: number | null;
  lineItems: DocLineItem[];
  totals: DocTotals;
  notes: string | null;
}

export interface RenderedDocument {
  bytes: Uint8Array;
  /** Suggested file name, e.g. "TIMSOM001 Sales Specification Spec No 1.pdf". */
  fileName: string;
  mimeType: "application/pdf";
}

// DOC_TITLES + the doc-type enumeration moved to the D2 single-source registry
// (services/documents/registry.ts). Re-exported here for the existing import sites.
export { DOC_TITLES, DOC_TYPE_LABELS, DOC_TYPES, titleFor, affinityOf } from "./registry";
