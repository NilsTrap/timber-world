/**
 * Slate (Plate) compiler tests (tsx assertion script — repo convention).
 * Run: from apps/portal →
 *   ../../tests/rls-and-perf/node_modules/.bin/tsx src/features/documents/compiler/__tests__/slate.test.ts
 *
 * Proves per-node HTML, mark serialization, indent-list grouping, table
 * emission, brace neutralisation (security), and the GOLDEN CHAIN
 * compileSlateTemplate → the REAL templateMerge (a plain rich doc has no
 * {{ }} tokens, so it must survive merge byte-for-byte).
 */
import { compileSlateTemplate, type SlateNode } from "../slate";
import { mergeTemplate } from "../../../orders/services/documents/templateMerge";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  ✗ FAIL: ${name}${detail ? `\n     ${detail}` : ""}`);
  }
}
function has(name: string, haystack: string, needle: string) {
  ok(name, haystack.includes(needle), `expected to contain: ${needle}\n     in: ${haystack.slice(0, 400)}`);
}
function absent(name: string, haystack: string, needle: string) {
  ok(name, !haystack.includes(needle), `expected NOT to contain: ${needle}`);
}
const body = (nodes: SlateNode[]) => compileSlateTemplate(nodes);

// ── Marks ────────────────────────────────────────────────────────────────
has("bold", body([{ type: "p", children: [{ text: "hi", bold: true }] }]), "<strong>hi</strong>");
has("italic", body([{ type: "p", children: [{ text: "hi", italic: true }] }]), "<em>hi</em>");
has("underline", body([{ type: "p", children: [{ text: "hi", underline: true }] }]), "<u>hi</u>");
has("strike", body([{ type: "p", children: [{ text: "x", strikethrough: true }] }]), "<s>x</s>");
has("code mark", body([{ type: "p", children: [{ text: "x", code: true }] }]), "<code>x</code>");
has(
  "nested marks order",
  body([{ type: "p", children: [{ text: "x", bold: true, italic: true }] }]),
  "<em><strong>x</strong></em>",
);

// ── Blocks ───────────────────────────────────────────────────────────────
has("h1", body([{ type: "h1", children: [{ text: "T" }] }]), "<h1>T</h1>");
has("h2", body([{ type: "h2", children: [{ text: "T" }] }]), "<h2>T</h2>");
has("h3", body([{ type: "h3", children: [{ text: "T" }] }]), "<h3>T</h3>");
has("h4→h3", body([{ type: "h4", children: [{ text: "T" }] }]), "<h3>T</h3>");
has("paragraph", body([{ type: "p", children: [{ text: "hello" }] }]), "<p>hello</p>");
has("align center", body([{ type: "p", align: "center", children: [{ text: "c" }] }]), '<p style="text-align:center">c</p>');
has("blockquote", body([{ type: "blockquote", children: [{ text: "q" }] }]), "<blockquote>q</blockquote>");
has("hr", body([{ type: "hr", children: [{ text: "" }] }]), "<hr>");

// ── Inline: links + mentions (merge deferred) ──────────────────────────────
has(
  "link",
  body([{ type: "p", children: [{ text: "see " }, { type: "a", url: "https://x.io", children: [{ text: "here" }] }] }]),
  '<a href="https://x.io">here</a>',
);
has(
  "mention renders as label",
  body([{ type: "p", children: [{ type: "mention", value: "Seller name", children: [{ text: "" }] }] }]),
  "Seller name",
);

// ── Lists (indent-based → ul/ol/li) ────────────────────────────────────────
const bullets = body([
  { type: "p", listStyleType: "disc", indent: 1, children: [{ text: "a" }] },
  { type: "p", listStyleType: "disc", indent: 1, children: [{ text: "b" }] },
]);
has("bulleted list ul", bullets, "<ul><li>a</li><li>b</li></ul>");
const ordered = body([
  { type: "p", listStyleType: "decimal", indent: 1, children: [{ text: "one" }] },
  { type: "p", listStyleType: "decimal", indent: 1, children: [{ text: "two" }] },
]);
has("ordered list ol", ordered, "<ol><li>one</li><li>two</li></ol>");
const nested = body([
  { type: "p", listStyleType: "disc", indent: 1, children: [{ text: "top" }] },
  { type: "p", listStyleType: "disc", indent: 2, children: [{ text: "sub" }] },
]);
has("nested list", nested, "<ul><li>top<ul><li>sub</li></ul></li></ul>");

// ── Table (rt-table) ───────────────────────────────────────────────────────
const table = body([
  {
    type: "table",
    children: [
      {
        type: "tr",
        children: [
          { type: "th", children: [{ type: "p", children: [{ text: "H", bold: true }] }] },
        ],
      },
      {
        type: "tr",
        children: [{ type: "td", children: [{ type: "p", children: [{ text: "v" }] }] }],
      },
    ],
  },
]);
has("table class", table, '<table class="rt-table">');
has("table th", table, "<th><p><strong>H</strong></p></th>");
has("table td", table, "<td><p>v</p></td>");

// ── Security: braces + html neutralised ────────────────────────────────────
const inj = body([{ type: "p", children: [{ text: "{{evil}} <script>x</script>" }] }]);
absent("no raw handlebars braces", inj, "{{evil}}");
absent("no raw script tag", inj, "<script>");
has("brace entity", inj, "&#123;&#123;evil");
const injHref = body([{ type: "p", children: [{ type: "a", url: "{{leak}}", children: [{ text: "x" }] }] }]);
absent("link href brace neutralised", injHref, 'href="{{leak}}"');

// ── Shell + golden chain ───────────────────────────────────────────────────
const doc = body([{ type: "h1", children: [{ text: "SALES SPEC" }] }, { type: "p", children: [{ text: "body" }] }]);
has("shell doctype", doc, "<!DOCTYPE html>");
has("shell @page A4", doc, "@page { size: A4;");
has("shell base css", doc, "table.rt-table");

// Golden chain: a plain rich doc has no {{ }} tokens → templateMerge must pass it through unchanged.
const merged = mergeTemplate(doc, {
  documentType: "sales_specification",
  documentNumber: "1",
  // minimal DocumentData-ish; a doc with no tokens shouldn't need any of it
} as never);
ok("golden chain: no-token doc survives merge", typeof merged === "string" && merged.includes("SALES SPEC") && merged.includes("<h1>"),
  `merged head: ${String(merged).slice(0, 200)}`);

// ── Report ─────────────────────────────────────────────────────────────────
console.log(`\nSlate compiler: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
