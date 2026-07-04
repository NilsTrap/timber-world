/**
 * Types for the document-templates feature (E6 + E6.1 WYSIWYG).
 *
 * Templates are global Handlebars sources stored in `document_templates`, edited
 * by house staff and merged against `DocumentData` at generation time. This
 * feature owns the CRUD + import/preview server actions and the TipTap visual
 * editor (E6.1).
 *
 * content_format selects the editor surface: 'wysiwyg' rows keep their TipTap
 * document in `doc_json` (the editable source of truth) and the compiler writes
 * the derived Handlebars into `html` on save; 'html' rows (the 7 seeds + .docx
 * imports) edit the raw `html` directly. The render pipeline reads ONLY `html`.
 */
import type { DocType } from "@/features/orders/services/dealModel";
import type { PageSettings, TipTapDoc } from "@/features/documents/compiler";
import type { SlateNode } from "@/features/documents/compiler/slate";
import type { TemplateWarning } from "@/features/documents/compiler/validate";

export type { PageSettings, TipTapDoc };
export type { TemplateWarning, TemplateWarningKind, TemplateValidation } from "@/features/documents/compiler/validate";

/** A Plate (Slate) document value — the wysiwyg editable source of truth. */
export type SlateValue = SlateNode[];

/** Which editor surface a template opens in / is authored with. */
export type ContentFormat = "html" | "wysiwyg";

/** ActionResult convention (matches features/access/types.ts). */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/** Full template row (includes the Handlebars source + WYSIWYG source). */
export interface DocumentTemplate {
  id: string;
  docType: DocType;
  name: string;
  /** Derived (for wysiwyg) or authored (for html) Handlebars source — the ONLY render input. */
  html: string;
  isDefault: boolean;
  isActive: boolean;
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** 'wysiwyg' → edit via doc_json (visual); 'html' → edit raw html (Advanced tab). */
  contentFormat: ContentFormat;
  /** Plate (Slate) document — the editable source of truth for wysiwyg rows; null for html rows. */
  docJson: SlateValue | null;
  /** A4 margin / footer / logo URL for wysiwyg rows; null for html rows. */
  pageSettings: PageSettings | null;
  /** Storage object path of the uploaded logo (for replace/cleanup); null if none. */
  logoPath: string | null;
}

/** List view — omits the (potentially large) html/doc_json bodies. */
export interface DocumentTemplateSummary {
  id: string;
  docType: DocType;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  version: number;
  updatedAt: string;
  contentFormat: ContentFormat;
}

/**
 * Input to saveTemplate (create when id is absent, update when present).
 * For a wysiwyg save, `docJson` (+ optional `pageSettings`) is authoritative and
 * `html` is recompiled server-side from it (any client-sent html is ignored).
 * For an html save, `html` is authoritative and `docJson` stays null.
 */
export interface SaveTemplateInput {
  id?: string;
  docType: DocType;
  name: string;
  html: string;
  isDefault: boolean;
  isActive: boolean;
  contentFormat?: ContentFormat;
  docJson?: SlateValue | null;
  pageSettings?: PageSettings | null;
}

/**
 * Result of a successful saveTemplate: the persisted row PLUS the S4 token-
 * validation warnings from the server-side pass (run AFTER a successful compile).
 * `warnings` is advisory only — the save always succeeds; an empty array means no
 * unresolved placeholders were found.
 */
export interface SaveTemplateResult {
  template: DocumentTemplate;
  warnings: TemplateWarning[];
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

/** Preview a WYSIWYG template: compile doc_json → merge sample DocumentData → html. */
export interface PreviewTemplateJsonInput {
  docJson: SlateValue;
  docType: DocType;
  pageSettings?: PageSettings | null;
}
