/**
 * Document shell — wraps the serialized body in a complete, print-ready HTML
 * document. BASE_CSS is lifted from the E6 seeded templates so compiled PDFs
 * match the current look, and is INDEPENDENT of Tailwind (the editor's own CSS
 * never affects the generated PDF). PURE: no react/@tiptap.
 */
import { escapeAttr, escapeText } from "./nodes";
import type { PageSettings } from "./types";

/**
 * Print CSS for the compiled document. Styles what the compiler EMITS:
 * typography (h1–3, p, lists, marks), the line-items table (`table.items`, the
 * seeded look), the user rich-text table (`table.rt-table`), `.num` right-align,
 * images, the letterhead logo, and the running footer.
 */
export const BASE_CSS = `
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 0; line-height: 1.45; }
h1 { font-size: 16px; font-weight: 700; margin: 0 0 6px; }
h2 { font-size: 14px; font-weight: 700; margin: 10px 0 4px; }
h3 { font-size: 12px; font-weight: 700; text-transform: none; margin: 8px 0 3px; }
p { margin: 4px 0; }
ul, ol { margin: 4px 0; padding-left: 20px; }
li { margin: 1px 0; }
strong { font-weight: 700; } em { font-style: italic; } u { text-decoration: underline; }
a { color: #1a1a1a; text-decoration: underline; }
hr { border: 0; border-top: 1px solid #b4b4b4; margin: 10px 0; }
img { max-width: 100%; }
/* Line-items table (repeating rows) — the seeded look */
table.items { width: 100%; border-collapse: collapse; margin: 10px 0; }
table.items th { background: #3c525c; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; }
table.items td { padding: 4px 6px; border-bottom: 1px solid #e2e2e2; font-size: 10px; vertical-align: top; }
table.items .num { text-align: right; }
/* User rich-text table */
table.rt-table { width: 100%; border-collapse: collapse; margin: 8px 0; table-layout: fixed; }
table.rt-table td, table.rt-table th { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 10px; vertical-align: top; }
table.rt-table th { background: #f1f5f9; font-weight: 600; text-align: left; }
.num { text-align: right; }
/* Letterhead + footer */
.doc-logo { margin-bottom: 10px; }
.doc-logo img { max-height: 64px; }
.doc-footer { position: fixed; bottom: 4mm; left: 0; right: 0; text-align: center; font-size: 9px; color: #8a8a8a; }
`.trim();

/**
 * Wrap a compiled body fragment in a full <!DOCTYPE html> document with the
 * base CSS, A4 @page (margin from pageSettings), an optional letterhead logo at
 * the top of the body, and an optional running footer.
 */
export function compileShell(bodyHtml: string, pageSettings?: PageSettings | null): string {
  const margin = clampMargin(pageSettings?.marginMm);
  const logoUrl = pageSettings?.logoUrl;
  const logo = logoUrl ? `<div class="doc-logo"><img src="${escapeAttr(logoUrl)}"></div>` : "";
  const footerText = pageSettings?.footerText?.trim();
  // Reserve space for the fixed footer by padding the @page bottom margin.
  const footer = footerText ? `<div class="doc-footer">${escapeText(footerText)}</div>` : "";
  const bottomMargin = footerText ? margin + 6 : margin;
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}\n` +
    `@page { size: A4; margin: ${margin}mm ${margin}mm ${bottomMargin}mm ${margin}mm; }\n` +
    `body { padding: 0 0 0 0; }\n` +
    `</style></head><body>${logo}${bodyHtml}${footer}</body></html>`
  );
}

/** A4 margin in mm, clamped to a sane 0–40 range (default 12). */
function clampMargin(mm: number | undefined): number {
  if (typeof mm !== "number" || !Number.isFinite(mm)) return 12;
  return Math.min(40, Math.max(0, Math.round(mm)));
}
