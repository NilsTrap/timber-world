/**
 * D2 · doc-type registry (single source of truth) + D1 titleFor + D3 affinity gate.
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/orders/services/documents/__tests__/doc-registry.test.ts`
 */
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  DOC_TITLES,
  affinityOf,
  titleFor,
  expectedDocsForDealKind,
  canGenerateOnDeal,
} from "../registry";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}
function ok(label: string, cond: boolean) { eq(label, cond, true); }

// ── the 7 keys, exactly (matches the two DB CHECK constraints) ────────────────
eq("7 doc types", DOC_TYPES.length, 7);
eq("keys in order", DOC_TYPES, ["sales_spec", "purchase_spec", "contract", "proforma_invoice", "invoice", "packing_list", "cmr"]);
eq("labels + titles cover every key", [Object.keys(DOC_TYPE_LABELS).length, Object.keys(DOC_TITLES).length], [7, 7]);

// ── §8.2 relabel: the buy-side order is "Purchase order" ──────────────────────
eq("purchase_spec label = Purchase order", DOC_TYPE_LABELS.purchase_spec, "Purchase order");
eq("purchase_spec title = PURCHASE ORDER", DOC_TITLES.purchase_spec, "PURCHASE ORDER");

// ── affinity (§8.2 direction) ─────────────────────────────────────────────────
eq("sales_spec → sell", affinityOf("sales_spec"), "sell");
eq("purchase_spec → buy", affinityOf("purchase_spec"), "buy");
eq("contract → sell", affinityOf("contract"), "sell");
eq("proforma → both", affinityOf("proforma_invoice"), "both");
eq("invoice → both", affinityOf("invoice"), "both");
eq("packing_list → both", affinityOf("packing_list"), "both");
eq("cmr → both", affinityOf("cmr"), "both");

// ── D1 · quotation → firm heading (one document, two states) ──────────────────
eq("spec quotation title", titleFor("sales_spec", "quotation"), "QUOTATION");
eq("spec firm title", titleFor("sales_spec", "firm"), "ORDER SPECIFICATION");
eq("spec null title falls back", titleFor("sales_spec", null), "SALES SPECIFICATION");
eq("doc_state ignored for non-spec", titleFor("invoice", "firm" as never), "INVOICE");

// ── D3 · expected set per direction ───────────────────────────────────────────
const sell = expectedDocsForDealKind("buy_sell");
const buy = expectedDocsForDealKind("purchase_only");
ok("sell deal expects sales_spec", sell.includes("sales_spec"));
ok("sell deal expects contract", sell.includes("contract"));
ok("sell deal does NOT expect purchase_spec", !sell.includes("purchase_spec"));
ok("buy leg expects purchase_spec", buy.includes("purchase_spec"));
ok("buy leg does NOT expect sales_spec", !buy.includes("sales_spec"));
ok("buy leg does NOT expect contract", !buy.includes("contract"));
ok("both share the shared docs (cmr)", sell.includes("cmr") && buy.includes("cmr"));

// ── D3 · generation affinity gate ─────────────────────────────────────────────
eq("purchase order on sell deal → blocked", canGenerateOnDeal("purchase_spec", "buy_sell").ok, false);
eq("purchase order block points to buy leg", (canGenerateOnDeal("purchase_spec", "buy_sell") as { otherLeg: string }).otherLeg, "buy");
eq("purchase order on buy leg → ok", canGenerateOnDeal("purchase_spec", "purchase_only").ok, true);
eq("sales spec on sell deal → ok", canGenerateOnDeal("sales_spec", "buy_sell").ok, true);
eq("sales spec on buy leg → blocked", canGenerateOnDeal("sales_spec", "purchase_only").ok, false);
eq("shared doc (invoice) anywhere → ok", [canGenerateOnDeal("invoice", "buy_sell").ok, canGenerateOnDeal("invoice", "purchase_only").ok], [true, true]);

console.log(`\ndoc-registry.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
