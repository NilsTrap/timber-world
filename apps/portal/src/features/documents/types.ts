/**
 * Types for the document-templates feature (E6).
 *
 * Templates are global Handlebars sources stored in `document_templates`, edited
 * by house staff and merged against `DocumentData` at generation time. This
 * feature owns the CRUD + import/preview server actions; the editor UI (Plate)
 * is wired separately.
 */
import type { DocType } from "@/features/orders/services/dealModel";

/** ActionResult convention (matches features/access/types.ts). */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/** Full template row (includes the Handlebars source). */
export interface DocumentTemplate {
  id: string;
  docType: DocType;
  name: string;
  html: string;
  isDefault: boolean;
  isActive: boolean;
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** List view — omits the (potentially large) html body. */
export interface DocumentTemplateSummary {
  id: string;
  docType: DocType;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  version: number;
  updatedAt: string;
}

/** Input to saveTemplate (create when id is absent, update when present). */
export interface SaveTemplateInput {
  id?: string;
  docType: DocType;
  name: string;
  html: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface ImportDocxResult {
  html: string;
  /** Any conversion warnings mammoth reported (unrecognised styles, etc.). */
  messages: string[];
}

export interface PreviewTemplateInput {
  html: string;
  docType: DocType;
}
