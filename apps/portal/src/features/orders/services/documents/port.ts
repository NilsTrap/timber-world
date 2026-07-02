/**
 * Document-generation port — one interface, swappable adapters (the rule from
 * the integration plan: UI/MCP call through this; the implementation moves from
 * the interim local renderer to the Oscar MCP generator with no caller change).
 *
 *  • local-jspdf  → renders here with the salvaged jsPDF renderers (interim).
 *  • gotenberg    → merges a Handlebars template (document_templates) and converts
 *                   the HTML to PDF via a Gotenberg Chromium instance (E6). Chosen
 *                   first when GOTENBERG_URL is set; falls back to local per type.
 *  • oscar-mcp    → calls the Oscar general document-generation MCP tool
 *                   (template ref + data → file). Config-gated; throws until the
 *                   Timber Oscar instance is provisioned (E6).
 *
 * The adapter is chosen by env so prod can flip generators without code changes.
 */
import { renderDocument } from "./index";
import type { DocumentData, RenderedDocument } from "./types";
// Gotenberg adapter lives in its own file (imports mergeTemplate + admin client).
// The import is circular (gotenberg.ts imports localJsPdfGenerator from here) but
// safe: both usages are deferred to runtime function bodies, not module init.
import { gotenbergGenerator } from "./gotenberg";

export interface GenerationResult {
  rendered: RenderedDocument;
  /** Set by the Oscar adapter when generation happens there (stored on the deal). */
  oscarDocId?: string | null;
  oscarDocUrl?: string | null;
}

export interface DocumentGenerator {
  readonly name: string;
  generate(data: DocumentData): Promise<GenerationResult>;
}

/** Interim: render locally with jsPDF (all types route through the generic renderer). */
export const localJsPdfGenerator: DocumentGenerator = {
  name: "local-jspdf",
  async generate(data: DocumentData): Promise<GenerationResult> {
    return { rendered: renderDocument(data) };
  },
};

/** Re-exported for direct use/testing; selected by getDocumentGenerator(). */
export { gotenbergGenerator };

/** Target: Oscar's general document generator over MCP. Not wired yet (E6). */
export const oscarMcpGenerator: DocumentGenerator = {
  name: "oscar-mcp",
  async generate(): Promise<GenerationResult> {
    throw new Error(
      "Oscar document generator is not configured yet (set OSCAR_DOCGEN_ENABLED + the Oscar MCP endpoint). Using the interim local renderer."
    );
  },
};

/**
 * Pick the active generator. Order of precedence:
 *   1. Gotenberg (Handlebars template → HTML → PDF) when GOTENBERG_URL is set.
 *   2. Oscar MCP when OSCAR_DOCGEN_ENABLED is truthy and the endpoint configured.
 *   3. Interim local jsPDF renderer (default).
 * The Gotenberg adapter itself falls back to local per-type when a template is
 * missing, so enabling it never hard-fails a document.
 */
export function getDocumentGenerator(): DocumentGenerator {
  if (process.env.GOTENBERG_URL) {
    return gotenbergGenerator;
  }
  if (process.env.OSCAR_DOCGEN_ENABLED === "true" && process.env.OSCAR_MCP_URL) {
    return oscarMcpGenerator;
  }
  return localJsPdfGenerator;
}
