/**
 * Handlebars template merge — the pure core of the E6 document generator.
 *
 * `mergeTemplate(html, data)` compiles a Handlebars template (stored in
 * `document_templates.html`) and renders it against a `DocumentData` context,
 * producing print-ready HTML that is handed to Gotenberg for PDF conversion.
 *
 * The registered helpers mirror the formatters in `specification.ts` (the interim
 * jsPDF renderer) so the Handlebars output matches the visual/number conventions:
 *   • money  — cents → "1 234,56" (space thousands, comma decimals, NO symbol)
 *   • moneyCur — like money but suffixed with the document currency (root ctx)
 *   • fmtM3  — volume → up to 3 decimals, comma decimal
 *   • fmtDate — ISO date → "DD.MM.YYYY."
 *   • pct    — number → "21%"
 *
 * PURE: no DB, no I/O — so it runs in Node for unit tests and on the server.
 * Runs server-side only (Handlebars is not shipped to the client). A private
 * Handlebars environment is used (Handlebars.create) so helper registration is
 * isolated and does not leak into any global instance.
 */
import Handlebars from "handlebars";
import type { DocumentData } from "./types";

// ── Formatters (match specification.ts exactly) ────────────────────────────

/** cents → "1 234,56" (space thousands, comma decimal, no currency symbol). */
export function fmtAmount(cents: number | null | undefined): string {
  if (cents == null) return "";
  const v = cents / 100;
  const [int = "0", dec = "00"] = v.toFixed(2).split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSep},${dec}`;
}

/** volume → up to 3 decimals, comma decimal, space thousands. */
export function fmtM3(v: number | null | undefined): string {
  if (v == null) return "";
  const [int = "0", dec = "000"] = v.toFixed(3).split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSep},${dec}`;
}

/** ISO date string → "DD.MM.YYYY." (UTC, trailing dot). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}.`;
}

/** number → "21%" (drops nothing; renders empty for null/undefined). */
export function pct(n: number | null | undefined): string {
  if (n == null) return "";
  return `${n}%`;
}

/**
 * The helper set, exported so it can be unit-tested directly without compiling
 * a template. Each maps a Handlebars helper name to its implementation.
 */
export const templateHelpers = {
  money: (cents: number | null | undefined) => fmtAmount(cents),
  fmtM3: (v: number | null | undefined) => fmtM3(v),
  fmtDate: (iso: string | null | undefined) => fmtDate(iso),
  pct: (n: number | null | undefined) => pct(n),
} as const;

// ── Handlebars environment (isolated, helpers registered once) ─────────────

const hb = Handlebars.create();

hb.registerHelper("money", function (cents: unknown) {
  return fmtAmount(cents as number | null | undefined);
});
hb.registerHelper("fmtM3", function (v: unknown) {
  return fmtM3(v as number | null | undefined);
});
hb.registerHelper("fmtDate", function (iso: unknown) {
  return fmtDate(iso as string | null | undefined);
});
hb.registerHelper("pct", function (n: unknown) {
  return pct(n as number | null | undefined);
});

/**
 * `{{moneyCur x}}` — formatted amount suffixed with the document currency,
 * read from the root render context (so templates don't repeat `{{currency}}`).
 */
hb.registerHelper("moneyCur", function (this: unknown, cents: unknown, options: Handlebars.HelperOptions) {
  const amount = fmtAmount(cents as number | null | undefined);
  if (!amount) return "";
  const currency = (options?.data?.root as DocumentData | undefined)?.currency ?? "";
  return currency ? `${amount} ${currency}` : amount;
});

// Cache compiled templates by source string — templates are reused across many
// documents and compilation is the expensive step. BOUNDED (LRU-ish): the live
// preview merges the editor's HTML on every keystroke, so an unbounded cache
// keyed by source would grow without limit over an editing session. Cap the
// size and evict the oldest entry (Map preserves insertion order).
const compiledCache = new Map<string, Handlebars.TemplateDelegate>();
const COMPILED_CACHE_MAX = 64;

/**
 * Compile `html` as a Handlebars template and render it against `data`.
 * Missing / null fields render as empty strings (Handlebars default), never
 * the literal "undefined".
 */
export function mergeTemplate(html: string, data: DocumentData): string {
  let tpl = compiledCache.get(html);
  if (tpl) {
    // Touch: refresh recency so hot templates aren't evicted.
    compiledCache.delete(html);
    compiledCache.set(html, tpl);
  } else {
    // noEscape: false keeps HTML-escaping ON for merged values (defence against
    // stray angle brackets in party names / notes). Our template markup itself
    // is authored HTML and is not escaped (it IS the template).
    tpl = hb.compile(html, { noEscape: false });
    compiledCache.set(html, tpl);
    if (compiledCache.size > COMPILED_CACHE_MAX) {
      const oldest = compiledCache.keys().next().value;
      if (oldest !== undefined) compiledCache.delete(oldest);
    }
  }
  return tpl(data);
}
