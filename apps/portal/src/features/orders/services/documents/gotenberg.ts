/**
 * Gotenberg document generator — the E6 HTML→PDF adapter.
 *
 * Flow: load the active DEFAULT Handlebars template for the doc type from
 * `document_templates`, merge it against the `DocumentData`, POST the resulting
 * HTML to a Gotenberg Chromium instance, and return the PDF bytes.
 *
 * It plugs into the same `DocumentGenerator` port as the interim jsPDF renderer,
 * so the generation pipeline (orderDocuments.generateDocument) is unchanged.
 * If no template row exists for the type it FALLS BACK to the local jsPDF
 * renderer, so a missing template never hard-fails document generation.
 *
 * Templates are global (non-secret) and read with the service-role admin client
 * so generation works regardless of the acting user's RLS scope.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeTemplate } from "./templateMerge";
import { localJsPdfGenerator } from "./port";
import type { DocumentGenerator, GenerationResult } from "./port";
import type { DocumentData } from "./types";

/** Mirror of specification.ts's local sanitizeFileName (kept in sync by hand). */
function sanitizeFileName(s: string): string {
  return s.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, " ").trim();
}

interface TemplateRow {
  html: string;
}

/** Fetch the active default template HTML for a doc type, or null if none. */
async function loadDefaultTemplateHtml(docType: DocumentData["docType"]): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("document_templates")
    .select("html")
    .eq("doc_type", docType)
    .eq("is_default", true)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return (data as TemplateRow).html ?? null;
}

export const gotenbergGenerator: DocumentGenerator = {
  name: "gotenberg",
  async generate(data: DocumentData): Promise<GenerationResult> {
    const templateHtml = await loadDefaultTemplateHtml(data.docType);

    // No template configured for this type → never hard-fail; use the local
    // jsPDF renderer so the pipeline still produces a valid PDF.
    if (!templateHtml) {
      return localJsPdfGenerator.generate(data);
    }

    const html = mergeTemplate(templateHtml, data);

    const gotenbergUrl = process.env.GOTENBERG_URL;
    if (!gotenbergUrl) {
      // Should not happen (the selector only picks this adapter when the URL is
      // set), but guard so we degrade gracefully rather than throw a cryptic
      // fetch error.
      return localJsPdfGenerator.generate(data);
    }

    const form = new FormData();
    // Gotenberg's Chromium HTML route requires the entry file be "index.html".
    form.append("files", new Blob([html], { type: "text/html" }), "index.html");

    const headers: Record<string, string> = {};
    if (process.env.GOTENBERG_BEARER) {
      headers.Authorization = `Bearer ${process.env.GOTENBERG_BEARER}`;
    }

    const res = await fetch(`${gotenbergUrl.replace(/\/$/, "")}/forms/chromium/convert/html`, {
      method: "POST",
      headers,
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gotenberg conversion failed (${res.status} ${res.statusText}): ${body}`);
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    const fileName = sanitizeFileName(`${data.dealCode} ${data.docTitle} ${data.docNumber}.pdf`);

    return { rendered: { bytes, fileName, mimeType: "application/pdf" } };
  },
};
