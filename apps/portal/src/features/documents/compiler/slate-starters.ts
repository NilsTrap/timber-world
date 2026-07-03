/**
 * Starter document for a new template of a given type — the full, faithful
 * Plate version of that document (parties, line-items, totals, etc.) so a new
 * template opens ready-to-edit and generates the same PDF as the seeded one.
 */
import type { SlateNode } from "./slate";
import type { DocType } from "../../orders/services/dealModel";
import { SLATE_TEMPLATES } from "./slate-templates";

/** Plate's minimum valid document (one empty paragraph). */
export const EMPTY_SLATE_DOC: SlateNode[] = [{ type: "p", children: [{ text: "" }] }];

/** A fresh, independent copy of the doc type's full Plate template. */
export function slateStarterFor(docType: DocType): SlateNode[] {
  const tpl = SLATE_TEMPLATES[docType];
  // Deep clone so editing a new template never mutates the shared source.
  return tpl ? (JSON.parse(JSON.stringify(tpl)) as SlateNode[]) : [...EMPTY_SLATE_DOC];
}
