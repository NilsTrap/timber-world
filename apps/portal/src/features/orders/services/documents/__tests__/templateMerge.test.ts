/**
 * Pure-logic tests for the E6 Handlebars template merge + formatter helpers.
 * Run: from apps/portal, `../../tests/rls-and-perf/node_modules/.bin/tsx \
 *   src/features/orders/services/documents/__tests__/templateMerge.test.ts`
 */
import {
  fmtAmount,
  fmtM3,
  fmtDate,
  pct,
  mergeTemplate,
} from "../templateMerge";
import type { DocumentData } from "../types";

let passed = 0;
let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}
function truthy(label: string, actual: boolean) {
  if (actual) passed++;
  else {
    failed++;
    console.error(`✗ ${label}\n    expected: truthy\n    actual:   ${JSON.stringify(actual)}`);
  }
}

// ── money (fmtAmount): cents → "1 234,56" ──
eq("money 123456 → 1 234,56", fmtAmount(123456), "1 234,56");
eq("money 0 → 0,00", fmtAmount(0), "0,00");
eq("money 100 → 1,00", fmtAmount(100), "1,00");
eq("money 999 → 9,99", fmtAmount(999), "9,99");
eq("money 1000000 → 10 000,00", fmtAmount(1000000), "10 000,00");
eq("money null → empty", fmtAmount(null), "");
eq("money undefined → empty", fmtAmount(undefined), "");

// ── fmtM3: volume → up to 3 decimals, comma decimal ──
eq("fmtM3 1.5 → 1,500", fmtM3(1.5), "1,500");
eq("fmtM3 1234.567 → 1 234,567", fmtM3(1234.567), "1 234,567");
eq("fmtM3 0 → 0,000", fmtM3(0), "0,000");
eq("fmtM3 null → empty", fmtM3(null), "");

// ── fmtDate: ISO → "DD.MM.YYYY." ──
eq("fmtDate date-only → DD.MM.YYYY.", fmtDate("2026-07-02"), "02.07.2026.");
eq("fmtDate full ISO → DD.MM.YYYY.", fmtDate("2026-07-02T10:30:00Z"), "02.07.2026.");
eq("fmtDate null → empty", fmtDate(null), "");
eq("fmtDate empty → empty", fmtDate(""), "");

// ── pct ──
eq("pct 21 → 21%", pct(21), "21%");
eq("pct 0 → 0%", pct(0), "0%");
eq("pct null → empty", pct(null), "");

// ── mergeTemplate against a small template + sample data ──
const sample: DocumentData = {
  docType: "sales_spec",
  docTitle: "SALES SPECIFICATION",
  docNumber: "Spec No 1",
  docDate: "2026-07-02",
  dealCode: "TIMSOM001",
  currency: "EUR",
  seller: {
    name: "Timber World",
    regNo: "40000000000",
    vatNo: "LV40000000000",
    address: "Riga, Latvia",
    country: "LV",
    email: "sales@timber.lv",
    phone: "+371 20000000",
    bankName: "Swedbank",
    bankAccount: "LV00HABA0000000000000",
    bankSwift: "HABALV22",
  },
  buyer: {
    name: "DDC Ltd",
    regNo: null,
    vatNo: null, // deliberately null → must render empty, not "undefined"
    address: "London, UK",
    country: "GB",
    email: null,
    phone: null,
    bankName: null,
    bankAccount: null,
    bankSwift: null,
  },
  externalRefs: [{ label: "Client ref", value: "PO-42" }],
  incoterms: "FCA Riga",
  paymentTerms: "30 days",
  deliveryTerms: "By truck",
  deliveryDeadline: "2026-08-01",
  advancePct: 30,
  lineItems: [
    {
      lineNo: 1,
      description: "Oak board KD",
      dimensions: "27×150×2000",
      pieces: "100",
      volumeM3: 0.81,
      unit: "m3",
      unitPriceCents: 65000,
      lineTotalCents: 52650,
    },
    {
      lineNo: 2,
      description: "Pine plank",
      dimensions: "50×200×3000",
      pieces: "50",
      volumeM3: 1.5,
      unit: "m3",
      unitPriceCents: 30000,
      lineTotalCents: 45000,
    },
  ],
  totals: {
    totalVolumeM3: 2.31,
    subtotalCents: 97650,
    vatRate: 21,
    vatReference: null,
    vatCents: 20506,
    totalCents: 118156,
    amountInWords: "one thousand one hundred eighty-one euros 56 cents",
  },
  notes: null, // deliberately null → must render empty
};

const tpl = `<h1>{{docTitle}} — {{docNumber}}</h1>
<p>Date: {{fmtDate docDate}}</p>
<p>Seller: {{seller.name}} (VAT {{seller.vatNo}})</p>
<p>Buyer: {{buyer.name}} (VAT {{buyer.vatNo}})</p>
<table>{{#each lineItems}}<tr><td>{{lineNo}}</td><td>{{description}}</td><td>{{dimensions}}</td><td>{{pieces}}</td><td>{{fmtM3 volumeM3}}</td><td>{{money unitPriceCents}}</td><td>{{money lineTotalCents}}</td></tr>{{/each}}</table>
<p>Subtotal: {{money totals.subtotalCents}} {{currency}}</p>
<p>VAT {{totals.vatRate}}%: {{money totals.vatCents}}</p>
<p>Total: {{moneyCur totals.totalCents}}</p>
<p>Advance: {{pct advancePct}}</p>
<p>Notes: {{notes}}</p>`;

const out = mergeTemplate(tpl, sample);

truthy("title + number resolve", out.includes("SALES SPECIFICATION — Spec No 1"));
truthy("fmtDate helper in template", out.includes("Date: 02.07.2026."));
truthy("seller name + vat resolve", out.includes("Seller: Timber World (VAT LV40000000000)"));
truthy("each loop item 1 description", out.includes("Oak board KD"));
truthy("each loop item 2 description", out.includes("Pine plank"));
truthy("each loop money helper (line total)", out.includes("526,50"));
truthy("each loop fmtM3 helper", out.includes("1,500"));
truthy("subtotal money + currency literal", out.includes("Subtotal: 976,50 EUR"));
truthy("moneyCur reads root currency", out.includes("Total: 1 181,56 EUR"));
truthy("pct helper renders advance", out.includes("Advance: 30%"));
// null fields render empty, never the literal "undefined"
truthy("null buyer VAT renders empty", out.includes("Buyer: DDC Ltd (VAT )"));
truthy("null notes renders empty", out.includes("Notes: </p>"));
truthy("no literal 'undefined' anywhere in output", !out.includes("undefined"));

console.log(`\ntemplateMerge.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
