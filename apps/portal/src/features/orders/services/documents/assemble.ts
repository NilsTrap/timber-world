/**
 * Pure document-data assembly — given a deal's fields, party cards and an
 * allocated document number, produce the render-ready DocumentData (line
 * descriptions, totals, VAT, amount-in-words). No DB / no I/O, so it unit-tests
 * from a fixture. The DB-bound wrapper (fetch + number allocation) lives in
 * features/orders/services/orderDocuments.ts.
 */
import type { DealSide, DocType, OrderLineItem, OrderExternalRef } from "../dealModel";
import { resolveVat } from "../vat";
import { amountInWords } from "./amountInWords";
import { DOC_TITLES, type DocumentData, type DocLineItem, type PartyCard } from "./types";

/**
 * Compute a line's total in cents: prefer an explicit total; else unit price ×
 * the unit's quantity. If the expected quantity is missing/unparseable, the line
 * contributes 0 — never a phantom quantity-of-1, which would silently understate
 * a financial document's totals.
 */
export function lineTotalCents(li: Pick<OrderLineItem, "lineTotalCents" | "unitPriceCents" | "unit" | "volumeM3" | "pieces">): number {
  if (li.lineTotalCents != null) return li.lineTotalCents;
  if (li.unitPriceCents == null) return 0;
  if (li.unit === "m3") return li.volumeM3 != null ? Math.round(li.unitPriceCents * li.volumeM3) : 0;
  if (li.unit === "piece") {
    const pcs = li.pieces != null ? parseFloat(li.pieces) : NaN;
    return Number.isFinite(pcs) ? Math.round(li.unitPriceCents * pcs) : 0;
  }
  // m2 / linear_m / package have no quantity column yet → can't derive a total.
  return 0;
}

/** Assemble a line item's human description + dimensions string. */
export function toDocLine(li: OrderLineItem): DocLineItem {
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

export function refLabel(refType: string): string {
  switch (refType) {
    case "client_project": return "Client project";
    case "client_job": return "Client job";
    case "client_po": return "Client PO";
    default: return "Ref";
  }
}

export interface BuildDocumentDataInput {
  docType: DocType;
  side: DealSide;
  docNumber: string;
  /** ISO date string for the document. */
  docDate: string;
  dealCode: string;
  currency: string;
  seller: PartyCard;
  buyer: PartyCard;
  incoterms: string | null;
  incotermsPlace: string | null;
  advancePct: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  deliveryDeadline: string | null;
  notes: string | null;
  externalRefs: OrderExternalRef[];
  /** All line items for the deal; filtered to `side` here. */
  lineItems: OrderLineItem[];
}

/** Pure: build the render-ready DocumentData (VAT from the parties' countries). */
export function buildDocumentData(input: BuildDocumentDataInput): DocumentData {
  const items = input.lineItems.filter((li) => li.side === input.side);
  const docLines = items.map(toDocLine);
  const subtotalCents = docLines.reduce((s, l) => s + (l.lineTotalCents ?? 0), 0);
  const totalVolumeM3 = items.reduce((s, l) => s + (l.volumeM3 ?? 0), 0);

  const vat = resolveVat({ fromCountry: input.seller.country, toCountry: input.buyer.country });
  const vatCents = Math.round((subtotalCents * vat.rate) / 100);
  const totalCents = subtotalCents + vatCents;

  return {
    docType: input.docType,
    docTitle: DOC_TITLES[input.docType],
    docNumber: input.docNumber,
    docDate: input.docDate,
    dealCode: input.dealCode,
    currency: input.currency,
    seller: input.seller,
    buyer: input.buyer,
    externalRefs: input.externalRefs
      .filter((r) => r.refType !== "other")
      .map((r) => ({ label: r.label || refLabel(r.refType), value: r.refValue })),
    incoterms: input.incoterms ? `${input.incoterms}${input.incotermsPlace ? ` ${input.incotermsPlace}` : ""}` : null,
    paymentTerms: input.paymentTerms,
    deliveryTerms: input.deliveryTerms,
    deliveryDeadline: input.deliveryDeadline,
    advancePct: input.advancePct,
    lineItems: docLines,
    totals: {
      totalVolumeM3,
      subtotalCents,
      vatRate: vat.rate,
      vatReference: vat.reference,
      vatCents,
      totalCents,
      amountInWords: amountInWords(totalCents, input.currency),
    },
    notes: input.notes,
  };
}

/** Default counterparty side for a doc type (purchase docs face the producer/buy side). */
export function defaultSideFor(docType: DocType): DealSide {
  return docType === "purchase_spec" ? "buy" : "sell";
}
