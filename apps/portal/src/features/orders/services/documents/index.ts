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
import { DOC_TYPES } from "./registry";
import { renderSpecification } from "./specification";

export * from "./types";

export function renderDocument(data: DocumentData): RenderedDocument {
  // Interim: every registered type routes through the one generic, title-driven
  // renderer (title from the D2 registry via assemble's titleFor).
  if (isRendererImplemented(data.docType)) return renderSpecification(data);
  throw new Error(`Unknown document type: ${data.docType}`);
}

/** All known doc types (the D2 registry) render under the interim local generator. */
export function isRendererImplemented(docType: DocumentData["docType"]): boolean {
  return DOC_TYPES.includes(docType);
}
