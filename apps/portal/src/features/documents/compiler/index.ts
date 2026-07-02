/**
 * WYSIWYG template compiler — public entry.
 *
 * Walks a TipTap ProseMirror JSON document and emits a complete, standalone
 * Handlebars-HTML document that the FROZEN render pipeline (templateMerge.ts →
 * gotenberg.ts) consumes unchanged. TipTap JSON is the editable source of truth;
 * this HTML is a derived artifact written to document_templates.html on save.
 *
 * PURE: imports NO react/@tiptap, no I/O — runs identically in the saveTemplate
 * server action, the previewTemplateJson action, and tsx tests. Deterministic:
 * fixed attribute + mark order, no Date/random, byte-stable output.
 */
import { serializeChildren } from "./nodes";
import { compileShell } from "./shell";
import type { CompileOptions, TipTapDoc } from "./types";

export * from "./types";
export * from "./registry";

/**
 * Compile a TipTap document into a complete Handlebars-HTML document. The output
 * drops straight into Gotenberg's index.html; the {{ }} tokens are resolved by
 * the unchanged templateMerge.ts against DocumentData at generation time.
 */
export function compileTemplate(doc: TipTapDoc, opts: CompileOptions = {}): string {
  const body = serializeChildren(doc?.content);
  return compileShell(body, opts.pageSettings);
}
