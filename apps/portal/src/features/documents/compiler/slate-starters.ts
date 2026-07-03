/**
 * Plate (Slate) starter documents for new / converted templates. v1 keeps them
 * simple — a titled skeleton the user fills in visually. Merge fields come
 * later; for now these are plain rich-text scaffolds per document type.
 */
import type { SlateNode } from "./slate";
import type { DocType } from "../../orders/services/dealModel";

const TITLES: Record<string, string> = {
  sales_specification: "SALES SPECIFICATION",
  purchase_specification: "PURCHASE SPECIFICATION",
  sales_contract: "SALES CONTRACT",
  proforma_invoice: "PROFORMA INVOICE",
  invoice: "INVOICE",
  packing_list: "PACKING LIST",
  cmr: "CMR CONSIGNMENT NOTE",
};

/** A minimal, valid Slate document skeleton for the given document type. */
export function slateStarterFor(docType: DocType): SlateNode[] {
  const title = TITLES[docType] ?? "DOCUMENT";
  return [
    { type: "h1", children: [{ text: title }] },
    { type: "p", children: [{ text: "" }] },
    { type: "h3", children: [{ text: "Seller" }] },
    { type: "p", children: [{ text: "" }] },
    { type: "h3", children: [{ text: "Buyer" }] },
    { type: "p", children: [{ text: "" }] },
    { type: "h3", children: [{ text: "Details" }] },
    { type: "p", children: [{ text: "" }] },
  ];
}

/** Plate's minimum valid document (one empty paragraph). */
export const EMPTY_SLATE_DOC: SlateNode[] = [{ type: "p", children: [{ text: "" }] }];
