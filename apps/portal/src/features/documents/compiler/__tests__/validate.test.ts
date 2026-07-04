/**
 * Template token-validation tests (S4) — tsx assertion script (repo convention).
 * Run: from apps/portal →
 *   ../../tests/rls-and-perf/node_modules/.bin/tsx src/features/documents/compiler/__tests__/validate.test.ts
 *
 * Proves the WARN-only validator: unknown scalar tokens, line-items attr.<key>
 * columns for a deleted catalog field, hideWhen drift, base-path resolution
 * (a valid binding minus its helper prefix still resolves), dedupe, the
 * catalog-unknown (null) skip, the compiledHtml fallback, and — the regression
 * guard — that every SEEDED template validates clean (0 warnings).
 */
import { validateTemplate, type TemplateWarning } from "../validate";
import { MERGE_FIELD_LABELS } from "../registry";
import { SLATE_TEMPLATES } from "../slate-templates";
import type { SlateNode } from "../slate";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  ✗ FAIL: ${name}${detail ? `\n     ${detail}` : ""}`);
  }
}

const KNOWN = Object.keys(MERGE_FIELD_LABELS);
const mention = (value: string): SlateNode => ({ type: "mention", value, children: [{ text: "" }] });
const warn = (
  docJson: SlateNode[],
  catalogFieldKeys: string[] | null,
): TemplateWarning[] => validateTemplate({ docJson, knownScalarTokens: KNOWN, catalogFieldKeys }).warnings;

// ── 1 · A valid template → 0 warnings ───────────────────────────────────────
const validDoc: SlateNode[] = [
  { type: "h1", children: [mention("docTitle")] },
  { type: "p", hideWhen: "seller.address", children: [mention("seller.address")] },
  { type: "p", children: [mention("money totals.totalCents")] },
  // base path resolves even though the registry token carries a `pct` helper.
  { type: "p", children: [mention("totals.vatRate")] },
  {
    type: "line_items",
    columns: ["lineNo", "description", "attr.grade"],
    columnDefs: { "attr.grade": { header: "Grade", num: false } },
    children: [{ text: "" }],
  },
];
ok("valid template → 0 warnings", warn(validDoc, ["grade"]).length === 0,
  `got: ${JSON.stringify(warn(validDoc, ["grade"]))}`);

// ── 2 · An unknown scalar token → 1 warning ──────────────────────────────────
const bogusScalar = warn([{ type: "p", children: [mention("seller.bogus")] }], []);
ok("unknown scalar token → 1 warning", bogusScalar.length === 1, `got: ${JSON.stringify(bogusScalar)}`);
ok("unknown scalar kind + token", bogusScalar[0]?.kind === "unknown_token" && bogusScalar[0]?.token === "seller.bogus");

// ── 3 · line_items attr.<deleted_key> column → 1 warning ─────────────────────
const deletedCol = warn(
  [{ type: "line_items", columns: ["lineNo", "attr.deleted_key"], children: [{ text: "" }] }],
  ["grade"],
);
ok("deleted attr column → 1 warning", deletedCol.length === 1, `got: ${JSON.stringify(deletedCol)}`);
ok("deleted attr kind + field", deletedCol[0]?.kind === "unknown_field" && deletedCol[0]?.field === "deleted_key");

// ── Extra coverage ───────────────────────────────────────────────────────────
// A live attr column (key still exists) → no warning.
ok(
  "live attr column → 0 warnings",
  warn([{ type: "line_items", columns: ["attr.grade"], children: [{ text: "" }] }], ["grade"]).length === 0,
);

// catalogFieldKeys=null (unknown/loading) → attr checks SKIPPED, scalar still flagged.
const nullCatalog = warn(
  [
    { type: "line_items", columns: ["attr.whatever"], children: [{ text: "" }] },
    { type: "p", children: [mention("nope.field")] },
  ],
  null,
);
ok("null catalog skips attr, keeps scalar", nullCatalog.length === 1 && nullCatalog[0]?.kind === "unknown_token",
  `got: ${JSON.stringify(nullCatalog)}`);

// hideWhen referencing an unknown path → unknown_condition.
const badHide = warn([{ type: "p", hideWhen: "ghost.path", children: [{ text: "x" }] }], []);
ok("unknown hideWhen → unknown_condition", badHide.length === 1 && badHide[0]?.kind === "unknown_condition" && badHide[0]?.token === "ghost.path",
  `got: ${JSON.stringify(badHide)}`);

// Dedupe: the same bogus token used twice yields ONE warning.
const dup = warn(
  [
    { type: "p", children: [mention("seller.bogus")] },
    { type: "p", children: [mention("seller.bogus")] },
  ],
  [],
);
ok("dedupe repeated token → 1 warning", dup.length === 1, `got: ${dup.length}`);

// Fixed (non-attr) columns are never flagged.
ok(
  "fixed columns never flagged",
  warn([{ type: "line_items", columns: ["lineNo", "description", "volumeM3"], children: [{ text: "" }] }], []).length === 0,
);

// compiledHtml fallback: scalar {{bogus}} flagged; a `lookup` cell (quoted) ignored.
const htmlWarnings = validateTemplate({
  compiledHtml: '<p>{{seller.name}} {{bogus.token}}</p><td>{{lookup attr "grade"}}</td>',
  knownScalarTokens: KNOWN,
  catalogFieldKeys: [],
}).warnings;
ok("compiledHtml flags unknown scalar", htmlWarnings.length === 1 && htmlWarnings[0]?.token === "bogus.token",
  `got: ${JSON.stringify(htmlWarnings)}`);

// Never throws on garbage input.
let threw = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateTemplate({ docJson: [{ foo: 1 } as any, null as any], knownScalarTokens: KNOWN, catalogFieldKeys: [] });
  validateTemplate({ knownScalarTokens: KNOWN, catalogFieldKeys: null });
} catch {
  threw = true;
}
ok("never throws on garbage input", threw === false);

// ── Regression guard: every SEEDED template validates clean ──────────────────
for (const [docType, doc] of Object.entries(SLATE_TEMPLATES)) {
  const w = warn(doc as SlateNode[], []); // seeds use no catalog attr columns
  ok(`seeded template "${docType}" → 0 warnings`, w.length === 0, `got: ${JSON.stringify(w)}`);
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`\nTemplate validator: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
