/**
 * Document data — the validated, render-ready shape a document is built from.
 * Assembled by documentService from a deal; consumed by the per-type renderers.
 * Keeping this separate from DB rows is what lets the same renderer be unit-tested
 * from a fixture with no database.
 */
import type { DocType } from "../../types";

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
  docNumber: string;
  /** ISO date string for the document. */
  docDate: string;
  dealCode: string;
  currency: string;
  seller: PartyCard;
  buyer: PartyCard;
  externalRefs: { label: string; value: string }[];
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

export const DOC_TITLES: Record<DocType, string> = {
  sales_spec: "SALES SPECIFICATION",
  purchase_spec: "PURCHASE SPECIFICATION",
  contract: "SALES CONTRACT",
  proforma_invoice: "PROFORMA / ADVANCE INVOICE",
  invoice: "INVOICE",
  packing_list: "PACKING LIST",
  cmr: "CMR",
};
