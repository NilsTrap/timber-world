/**
 * Compiler types — the TipTap ProseMirror document shape + compile options.
 * PURE: no react/@tiptap imports (this module runs in the save server action,
 * the preview action, and tsx tests identically).
 */

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
}

export interface TipTapDoc {
  type: "doc";
  content?: TipTapNode[];
}

/** Page-level settings stored in document_templates.page_settings (not a PM node). */
export interface PageSettings {
  /** A4 page margin in millimetres (default 12). */
  marginMm?: number;
  /** Public URL of the letterhead logo (rendered at the top of the body). */
  logoUrl?: string | null;
  /** Optional static running footer text (escaped; no merge fields — put dynamic footer content in the body). */
  footerText?: string | null;
}

export interface CompileOptions {
  pageSettings?: PageSettings | null;
  /** Doc type — reserved for type-specific tweaks; unused today. */
  docType?: string;
}

/**
 * A self-contained editable template: the TipTap document + its page settings.
 * This is what the editor round-trips and what the starters (W6) are authored as.
 */
export interface TemplateEnvelope {
  doc: TipTapDoc;
  pageSettings?: PageSettings | null;
}
