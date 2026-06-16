/**
 * Document renderer registry. Add new document types here as their renderers land.
 * Sales & purchase specifications are implemented; the rest throw until built.
 */
import type { DocumentData, RenderedDocument } from "./types";
import { renderSpecification } from "./specification";

export * from "./types";

export function renderDocument(data: DocumentData): RenderedDocument {
  switch (data.docType) {
    case "sales_spec":
    case "purchase_spec":
      return renderSpecification(data);
    case "contract":
    case "proforma_invoice":
    case "invoice":
    case "packing_list":
    case "cmr":
      throw new Error(`Renderer for "${data.docType}" is not implemented yet`);
    default:
      throw new Error(`Unknown document type: ${data.docType}`);
  }
}

export function isRendererImplemented(docType: DocumentData["docType"]): boolean {
  return docType === "sales_spec" || docType === "purchase_spec";
}
