/**
 * Document renderer registry (interim local generator).
 *
 * `renderSpecification` is title-driven and generic, so as the stopgap before
 * Oscar's per-type generator (E6) every document type routes through it — each
 * gets a valid, correctly-titled PDF (parties, line-item table, totals, VAT,
 * amount-in-words). Oscar's generator will replace this with the real per-type
 * layouts (contract clauses, CMR boxes, packing-list columns, …).
 */
import type { DocumentData, RenderedDocument } from "./types";
import { renderSpecification } from "./specification";

export * from "./types";

export function renderDocument(data: DocumentData): RenderedDocument {
  switch (data.docType) {
    case "sales_spec":
    case "purchase_spec":
    case "contract":
    case "proforma_invoice":
    case "invoice":
    case "packing_list":
    case "cmr":
      // Interim: one generic renderer for all types (title from DOC_TITLES).
      return renderSpecification(data);
    default:
      throw new Error(`Unknown document type: ${data.docType}`);
  }
}

/** All known doc types render under the interim local generator. */
export function isRendererImplemented(docType: DocumentData["docType"]): boolean {
  return ["sales_spec", "purchase_spec", "contract", "proforma_invoice", "invoice", "packing_list", "cmr"].includes(docType);
}
