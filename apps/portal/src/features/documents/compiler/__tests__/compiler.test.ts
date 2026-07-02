/**
 * W2 · Compiler golden tests (tsx assertion script — repo convention).
 * Run: from apps/portal →
 *   ../../tests/rls-and-perf/node_modules/.bin/tsx src/features/documents/compiler/__tests__/compiler.test.ts
 *
 * Proves: per-node exact Handlebars-HTML, the {{#each lineItems}} contract,
 * merge-field + helper + hide-when-empty serialization, brace neutralisation,
 * determinism, AND the GOLDEN CHAIN — compileTemplate → the REAL templateMerge
 * → expected rendered string, so the compiler provably emits Handlebars the
 * frozen render pipeline accepts.
 */
import { compileTemplate } from "../index";
import { serializeNode } from "../nodes";
import { mergeTemplate } from "../../../orders/services/documents/templateMerge";
import type { TipTapDoc, TipTapNode } from "../types";

let pass = 0;
let fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  if (got === want) {
    pass++;
  } else {
    fail++;
    console.log(`  ✗ FAIL: ${name}\n     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
  }
}
function ok(name: string, cond: boolean) {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  ✗ FAIL: ${name}`);
  }
}
const S = (n: TipTapNode) => serializeNode(n);
const text = (t: string, marks?: { type: string; attrs?: Record<string, unknown> }[]): TipTapNode => ({ type: "text", text: t, marks });

// ── Per-node exact serialization ────────────────────────────────────────────
console.log("── per-node ──");
eq("text escaping + brace neutralisation", S(text('<b> & "q" {x}')), "&lt;b&gt; &amp; &quot;q&quot; &#123;x&#125;");
eq("bold mark", S(text("hi", [{ type: "bold" }])), "<strong>hi</strong>");
eq("italic+bold nested (bold outer, italic inner — fixed order)", S(text("x", [{ type: "bold" }, { type: "italic" }])), "<strong><em>x</em></strong>");
eq("link mark escapes href", S(text("go", [{ type: "link", attrs: { href: 'h"&<' } }])), '<a href="h&quot;&amp;&lt;">go</a>');
eq("paragraph plain", S({ type: "paragraph", content: [text("hello")] }), "<p>hello</p>");
eq("paragraph align center", S({ type: "paragraph", attrs: { textAlign: "center" }, content: [text("c")] }), '<p style="text-align:center">c</p>');
eq("paragraph align left omitted", S({ type: "paragraph", attrs: { textAlign: "left" }, content: [text("l")] }), "<p>l</p>");
eq("heading level 2", S({ type: "heading", attrs: { level: 2 }, content: [text("H")] }), "<h2>H</h2>");
eq("heading level clamped to 3", S({ type: "heading", attrs: { level: 6 }, content: [text("H")] }), "<h3>H</h3>");
eq("bullet list", S({ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("a")] }] }] }), "<ul><li><p>a</p></li></ul>");
eq("ordered list", S({ type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("a")] }] }] }), "<ol><li><p>a</p></li></ol>");
eq("hr", S({ type: "horizontalRule" }), "<hr>");
eq("hard break", S({ type: "hardBreak" }), "<br>");
eq("image with height", S({ type: "image", attrs: { src: "https://x/y.png", height: 40 } }), '<img src="https://x/y.png" style="max-height:40px">');
eq("image empty src drops", S({ type: "image", attrs: { src: "" } }), "");

// User rich-text table (never emits {{#each}})
eq(
  "user table with colspan + colwidth",
  S({
    type: "table",
    content: [
      { type: "tableRow", content: [
        { type: "tableHeader", attrs: { colspan: 2 }, content: [text("H")] },
        { type: "tableCell", attrs: { colwidth: [120] }, content: [{ type: "paragraph", content: [text("c")] }] },
      ] },
    ],
  }),
  '<table class="rt-table"><tbody><tr><th colspan="2">H</th><td style="width:120px"><p>c</p></td></tr></tbody></table>'
);
ok("user table never emits {{#each}}", !S({ type: "table", content: [] }).includes("{{#each"));

// Merge fields
eq("merge field simple", S({ type: "mergeField", attrs: { token: "seller.name" } }), "{{seller.name}}");
eq("merge field with helper", S({ type: "mergeField", attrs: { token: "money totals.totalCents" } }), "{{money totals.totalCents}}");
eq("merge field hide-when (helper path stripped)", S({ type: "mergeField", attrs: { token: "money totals.totalCents", hideWhen: true } }), "{{#if totals.totalCents}}{{money totals.totalCents}}{{/if}}");
eq("merge field empty token drops", S({ type: "mergeField", attrs: { token: "" } }), "");

// Block-level hide-when-empty derives the condition from the first pill
eq(
  "block hideWhenEmpty wraps in {{#if}}",
  S({ type: "paragraph", attrs: { hideWhenEmpty: true }, content: [text("Addr: "), { type: "mergeField", attrs: { token: "seller.address" } }] }),
  "{{#if seller.address}}<p>Addr: {{seller.address}}</p>{{/if}}"
);

// Line-items table — the loop contract
const liDefault = S({ type: "lineItemsTable", attrs: {} });
ok("line-items emits <tbody>{{#each lineItems}}…{{/each}}</tbody>", /<tbody>\{\{#each lineItems\}\}<tr>.*<\/tr>\{\{\/each\}\}<\/tbody>/.test(liDefault));
ok("line-items default has fmtM3 + money cells", liDefault.includes("{{fmtM3 volumeM3}}") && liDefault.includes("{{money unitPriceCents}}") && liDefault.includes("{{money lineTotalCents}}"));
eq(
  "line-items custom column subset + order",
  S({ type: "lineItemsTable", attrs: { columns: ["description", "lineTotalCents"] } }),
  '<table class="items"><thead><tr><th>Description</th><th class="num">Total</th></tr></thead><tbody>{{#each lineItems}}<tr><td>{{description}}</td><td class="num">{{money lineTotalCents}}</td></tr>{{/each}}</tbody></table>'
);
ok("line-items ignores unknown columns", !S({ type: "lineItemsTable", attrs: { columns: ["bogus"] } }).includes("bogus"));

// ── adversarial / robustness (post-review fixes) ────────────────────────────
console.log("── adversarial (post-review fixes) ──");
// escapeAttr must neutralise braces on EVERY attribute sink (no live-token injection)
eq("link href braces neutralised", S(text("go", [{ type: "link", attrs: { href: "http://x/{{seller.bankAccount}}" } }])), '<a href="http://x/&#123;&#123;seller.bankAccount&#125;&#125;">go</a>');
eq("image src braces neutralised", S({ type: "image", attrs: { src: "{{seller.vatNo}}" } }), '<img src="&#123;&#123;seller.vatNo&#125;&#125;">');
ok("image alt stray brace neutralised", !S({ type: "image", attrs: { src: "x.png", alt: "{{" } }).includes("{{"));
ok("shell logoUrl braces neutralised", !compileTemplate({ type: "doc", content: [] }, { pageSettings: { logoUrl: "{{#each lineItems}}" } }).includes("{{"));
// line-items prototype-key column must not crash and must be dropped
ok("line-items prototype-key column dropped (no crash)", (() => { const o = S({ type: "lineItemsTable", attrs: { columns: ["constructor", "description"] } }); return o.includes("{{description}}") && !o.toLowerCase().includes("constructor"); })());
// mergeField crafted/whitespace tokens must be dropped (never emit unbalanced Handlebars)
eq("mergeField whitespace token dropped", S({ type: "mergeField", attrs: { token: "   " } }), "");
eq("mergeField block-opener token dropped", S({ type: "mergeField", attrs: { token: "#each lineItems" } }), "");
eq("mergeField brace-bearing token dropped", S({ type: "mergeField", attrs: { token: "x}}{{#if y" } }), "");
eq("mergeField valid helper token still emitted", S({ type: "mergeField", attrs: { token: "moneyCur totals.totalCents" } }), "{{moneyCur totals.totalCents}}");
// heading with a non-numeric level falls back to h1 (no <hNaN>)
eq("heading non-numeric level → h1", S({ type: "heading", attrs: { level: "abc" }, content: [text("H")] }), "<h1>H</h1>");
// end-to-end: a braces-bearing href compiles + merges WITHOUT throwing and WITHOUT leaking data
ok("braces-in-href doc merges safely (no throw, no leak)", (() => {
  const c = compileTemplate({ type: "doc", content: [{ type: "paragraph", content: [text("go", [{ type: "link", attrs: { href: "http://x/{{seller.name}}" } }])] }] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = mergeTemplate(c, { docType: "sales_spec", seller: { name: "SECRET" }, buyer: {}, lineItems: [], externalRefs: [], totals: {} } as any);
  return !m.includes("SECRET") && m.includes("&#123;&#123;seller.name&#125;&#125;");
})());

// ── Determinism + shell ─────────────────────────────────────────────────────
console.log("── determinism + shell ──");
const detDoc: TipTapDoc = { type: "doc", content: [{ type: "paragraph", content: [text("x"), { type: "mergeField", attrs: { token: "seller.name" } }] }] };
eq("deterministic (same input → same output)", compileTemplate(detDoc), compileTemplate(detDoc));
const shell = compileTemplate(detDoc, { pageSettings: { marginMm: 15, logoUrl: "https://cdn/logo.png", footerText: "Confidential" } });
ok("shell is a full A4 document", shell.startsWith("<!DOCTYPE html>") && shell.includes("@page { size: A4;") && shell.includes("15mm"));
ok("shell renders logo img", shell.includes('<div class="doc-logo"><img src="https://cdn/logo.png"></div>'));
ok("shell renders footer", shell.includes('<div class="doc-footer">Confidential</div>'));
// Guard: the compiled HTML is itself a Handlebars template, so BASE_CSS / shell
// text must NEVER contain {{ or }} (a CSS comment with {{#each}} once broke merge).
ok("empty-doc shell is Handlebars-safe (no stray {{ or }})", !compileTemplate({ type: "doc", content: [] }).includes("{{") && !compileTemplate({ type: "doc", content: [] }).includes("}}"));

// ── GOLDEN CHAIN: compile → REAL templateMerge → expected rendered string ────
console.log("── golden chain (through real templateMerge) ──");
const golden: TipTapDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "mergeField", attrs: { token: "docTitle" } }] },
    { type: "paragraph", content: [text("No. "), { type: "mergeField", attrs: { token: "docNumber" } }, text(" · "), { type: "mergeField", attrs: { token: "fmtDate docDate" } }] },
    { type: "heading", attrs: { level: 3 }, content: [text("Seller")] },
    { type: "paragraph", content: [{ type: "mergeField", attrs: { token: "seller.name" } }] },
    { type: "paragraph", attrs: { hideWhenEmpty: true }, content: [{ type: "mergeField", attrs: { token: "seller.address" } }] },
    { type: "lineItemsTable", attrs: { columns: ["lineNo", "description", "dimensions", "pieces", "volumeM3", "unitPriceCents", "lineTotalCents"] } },
    { type: "paragraph", content: [text("Total: "), { type: "mergeField", attrs: { token: "moneyCur totals.totalCents" } }] },
    { type: "paragraph", content: [text("literal {{money 999}} stays inert")] },
  ],
};
const compiled = compileTemplate(golden);
const data = {
  docType: "sales_spec", docTitle: "SALES SPECIFICATION", docNumber: "No. 1", docDate: "2026-07-02T00:00:00Z",
  dealCode: "TIMSOM001", currency: "EUR",
  seller: { name: "Timber World SIA", address: "Brivibas 1, Riga" },
  buyer: { name: "DDC Ltd" }, externalRefs: [],
  incoterms: null, paymentTerms: null, deliveryTerms: null, deliveryDeadline: null, advancePct: null,
  lineItems: [
    { lineNo: 1, description: "Oak board", dimensions: "27x150x2000", pieces: "120", volumeM3: 0.972, unit: "m3", unitPriceCents: 68000, lineTotalCents: 66096 },
    { lineNo: 2, description: "Pine plank", dimensions: "50x200x3000", pieces: "40", volumeM3: 1.2, unit: "m3", unitPriceCents: 32000, lineTotalCents: 38400 },
    { lineNo: 3, description: "Birch plywood", dimensions: "18x1250x2500", pieces: "25", volumeM3: 1.406, unit: "m3", unitPriceCents: 45000, lineTotalCents: 63270 },
  ],
  totals: { totalVolumeM3: 3.578, subtotalCents: 167766, vatRate: 21, vatReference: null, vatCents: 35231, totalCents: 202997, amountInWords: "…" },
  notes: null,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const merged = mergeTemplate(compiled, data as any);

ok("compiled contains the {{#each lineItems}} loop", /<tbody>\{\{#each lineItems\}\}.*\{\{\/each\}\}<\/tbody>/.test(compiled));
ok("compiled wraps seller.address in {{#if}}", compiled.includes("{{#if seller.address}}"));
ok("merged: docTitle resolved", merged.includes("SALES SPECIFICATION"));
ok("merged: seller name", merged.includes("Timber World SIA"));
ok("merged: hidden-if address rendered (present)", merged.includes("Brivibas 1, Riga"));
ok("merged: moneyCur total → '2 029,97 EUR'", merged.includes("2 029,97 EUR"));
ok("merged: 3 loop rows", merged.includes("Oak board") && merged.includes("Pine plank") && merged.includes("Birch plywood"));
ok("merged: money helper → '660,96'", merged.includes("660,96"));
ok("merged: fmtM3 → '0,972'", merged.includes("0,972"));
ok("merged: fmtDate → '02.07.2026.'", merged.includes("02.07.2026."));
ok("merged: NO unresolved {{ left", !merged.includes("{{"));
ok("merged: literal '{{money 999}}' stayed inert (neutralised)", merged.includes("&#123;&#123;money 999&#125;&#125;"));

// hide-when-empty actually hides when the value is empty
const mergedNoAddr = mergeTemplate(compiled, { ...data, seller: { name: "X" } } as any);
ok("hide-when-empty: address block omitted when empty", !mergedNoAddr.includes("Brivibas") && !mergedNoAddr.includes("<p></p>"));

console.log(`\nW2 compiler: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
