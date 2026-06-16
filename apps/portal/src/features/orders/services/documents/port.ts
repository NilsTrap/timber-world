/**
 * Document-generation port — one interface, swappable adapters (the rule from
 * the integration plan: UI/MCP call through this; the implementation moves from
 * the interim local renderer to the Oscar MCP generator with no caller change).
 *
 *  • local-jspdf  → renders here with the salvaged jsPDF renderers (interim).
 *  • oscar-mcp    → calls the Oscar general document-generation MCP tool
 *                   (template ref + data → file). Config-gated; throws until the
 *                   Timber Oscar instance is provisioned (E6).
 *
 * The adapter is chosen by env so prod can flip to Oscar without code changes.
 */
import { renderDocument } from "./index";
import type { DocumentData, RenderedDocument } from "./types";

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
 * Pick the active generator. Defaults to the interim local renderer; flips to
 * Oscar when OSCAR_DOCGEN_ENABLED is truthy (and the endpoint is configured).
 */
export function getDocumentGenerator(): DocumentGenerator {
  if (process.env.OSCAR_DOCGEN_ENABLED === "true" && process.env.OSCAR_MCP_URL) {
    return oscarMcpGenerator;
  }
  return localJsPdfGenerator;
}
