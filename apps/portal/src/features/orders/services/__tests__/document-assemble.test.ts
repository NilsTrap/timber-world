/**
 * Pure-logic tests for document data assembly (no DB).
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/orders/services/__tests__/document-assemble.test.ts`
 */
import { lineTotalCents, toDocLine, buildDocumentData, defaultSideFor, refLabel } from "../documents/assemble";
import type { OrderLineItem } from "../dealModel";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}
function ok(label: string, cond: boolean) {
  if (cond) passed++;
  else { failed++; console.error(`✗ ${label}`); }
}

function li(over: Partial<OrderLineItem>): OrderLineItem {
  return {
    side: "sell", lineNo: 1, productName: null, woodSpecies: null, humidity: null, processing: null,
    quality: null, productType: null, gradeNote: null, productNameOptionId: null, woodSpeciesOptionId: null,
    humidityOptionId: null, processingOptionId: null, qualityOptionId: null, productTypeOptionId: null,
    thickness: null, width: null, length: null, pieces: null, volumeM3: null, unit: "m3",
    unitPriceCents: null, vatRate: null, lineTotalCents: null, notes: null, ...over,
  };
}

// lineTotalCents
eq("lineTotal explicit", lineTotalCents({ lineTotalCents: 12345, unitPriceCents: 999, unit: "m3", volumeM3: 2, pieces: null }), 12345);
eq("lineTotal m3", lineTotalCents({ lineTotalCents: null, unitPriceCents: 45000, unit: "m3", volumeM3: 2, pieces: null }), 90000);
eq("lineTotal loose_m3 (firewood, volume-priced)", lineTotalCents({ lineTotalCents: null, unitPriceCents: 6000, unit: "loose_m3", volumeM3: 25, pieces: null }), 150000);
eq("lineTotal crate (no qty column) → 0", lineTotalCents({ lineTotalCents: null, unitPriceCents: 5000, unit: "crate", volumeM3: null, pieces: null }), 0);
eq("lineTotal piece", lineTotalCents({ lineTotalCents: null, unitPriceCents: 1000, unit: "piece", volumeM3: null, pieces: "50" }), 50000);
eq("lineTotal m3 missing volume → 0 (no phantom qty=1)", lineTotalCents({ lineTotalCents: null, unitPriceCents: 7000, unit: "m3", volumeM3: null, pieces: null }), 0);
eq("lineTotal piece unparseable → 0", lineTotalCents({ lineTotalCents: null, unitPriceCents: 1000, unit: "piece", volumeM3: null, pieces: "various" }), 0);
eq("lineTotal package (no qty column) → 0 unless explicit", lineTotalCents({ lineTotalCents: null, unitPriceCents: 5000, unit: "package", volumeM3: null, pieces: null }), 0);
eq("lineTotal nothing", lineTotalCents({ lineTotalCents: null, unitPriceCents: null, unit: "m3", volumeM3: 2, pieces: null }), 0);

// toDocLine
eq("toDocLine desc + dims", toDocLine(li({ productName: "Board", woodSpecies: "Oak", processing: "Planed", thickness: "20", width: "100", length: "2000" })),
  { lineNo: 1, description: "Board, Oak, Planed", dimensions: "20 × 100 × 2000", pieces: null, volumeM3: null, unit: "m3", unitPriceCents: null, lineTotalCents: 0 });
eq("toDocLine empty desc → em dash", toDocLine(li({})).description, "—");

// defaultSideFor / refLabel
eq("defaultSide purchase", defaultSideFor("purchase_spec"), "buy");
eq("defaultSide sales", defaultSideFor("sales_spec"), "sell");
eq("refLabel po", refLabel("client_po"), "Client PO");

// buildDocumentData — LV seller → GB buyer = export 0% VAT; only 'sell' items; drop 'other' refs
const data = buildDocumentData({
  docType: "sales_spec", side: "sell", docNumber: "Spec No 1", docDate: "2026-06-16T00:00:00Z",
  dealCode: "TIMSOM001", currency: "EUR",
  seller: { name: "Timber Intl", country: "LV" },
  buyer: { name: "Somms Ltd", country: "GB" },
  incoterms: "FCA", incotermsPlace: "Riga", advancePct: 30, paymentTerms: "30/70",
  deliveryTerms: null, deliveryDeadline: null, notes: "x",
  externalRefs: [
    { refType: "client_po", refValue: "PO-9", label: null },
    { refType: "other", refValue: "idem:abc", label: "idempotency" },
  ],
  lineItems: [
    li({ side: "sell", lineNo: 1, productName: "Oak board", unit: "m3", volumeM3: 2, unitPriceCents: 45000 }),
    li({ side: "buy", lineNo: 1, productName: "Buy-side noise", unit: "m3", volumeM3: 99, unitPriceCents: 1 }),
  ],
});
eq("title", data.docTitle, "SALES SPECIFICATION");
eq("only sell line included", data.lineItems.length, 1);
eq("subtotal", data.totals.subtotalCents, 90000);
eq("export VAT 0%", data.totals.vatRate, 0);
eq("total = subtotal at 0% VAT", data.totals.totalCents, 90000);
eq("total volume only sell", data.totals.totalVolumeM3, 2);
eq("incoterms with place", data.incoterms, "FCA Riga");
eq("'other' ref filtered out, po kept", data.externalRefs, [{ label: "Client PO", value: "PO-9" }]);
ok("amountInWords non-empty", typeof data.totals.amountInWords === "string" && data.totals.amountInWords.length > 0);
ok("export VAT reference present", !!data.totals.vatReference && data.totals.vatReference.includes("Export"));

// GB → GB domestic = 20%
const dom = buildDocumentData({
  docType: "invoice", side: "sell", docNumber: "TIM0001", docDate: "2026-06-16T00:00:00Z",
  dealCode: "TIMSOM001", currency: "GBP",
  seller: { name: "S", country: "GB" }, buyer: { name: "B", country: "GB" },
  incoterms: null, incotermsPlace: null, advancePct: null, paymentTerms: null,
  deliveryTerms: null, deliveryDeadline: null, notes: null, externalRefs: [],
  lineItems: [li({ side: "sell", unit: "m3", volumeM3: 1, unitPriceCents: 10000 })],
});
eq("GB domestic VAT 20%", dom.totals.vatRate, 20);
eq("GB domestic vat cents", dom.totals.vatCents, 2000);
eq("GB domestic total", dom.totals.totalCents, 12000);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
