/**
 * Pure-logic tests for the deals feature — no database required.
 * Run: `cd apps/portal && npx tsx src/features/deals/__tests__/run-tests.ts`
 *
 * Covers numbering formatters, VAT resolution, amount-in-words, and the
 * Sales Specification PDF renderer (writes a real PDF artifact to /tmp).
 */
import { writeFileSync } from "node:fs";
import {
  buildDealCode,
  clientCodeFromName,
  pad,
  yyyymmdd,
  buildDocNumber,
} from "../services/numbering";
import { resolveVat } from "../services/vat";
import { amountInWords, integerToWords } from "../services/documents/amountInWords";
import { renderSpecification } from "../services/documents/specification";
import type { DocumentData } from "../services/documents/types";

let passed = 0;
let failed = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.error(`✗ ${label}\n    expected: ${e}\n    actual:   ${a}`);
  }
}

function ok(label: string, cond: boolean) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`✗ ${label}`);
  }
}

// ── Numbering ────────────────────────────────────────────────────────────────
eq("pad(5,3)", pad(5, 3), "005");
eq("clientCodeFromName(Somms Ltd)", clientCodeFromName("Somms Ltd"), "SOM");
eq("clientCodeFromName(empty)", clientCodeFromName(""), "XXX");
eq("clientCodeFromName(short 'Ab')", clientCodeFromName("Ab"), "ABX");
eq("clientCodeFromName('A1 B2 C3 D4')", clientCodeFromName("A1 B2 C3 D4"), "ABC");
eq("buildDealCode(TIM,SOM,1)", buildDealCode("TIM", "SOM", 1), "TIMSOM001");
eq("buildDealCode default entity", buildDealCode("", "XXX", 12), "TIMXXX012");
eq("yyyymmdd", yyyymmdd("2026-06-15T09:30:00Z"), "20260615");
eq("docNumber sales_spec", buildDocNumber({ docType: "sales_spec", entityCode: "TIM", date: "2026-06-15", seq: 3 }), "Spec No 3");
eq("docNumber contract first", buildDocNumber({ docType: "contract", entityCode: "TIM", date: "2026-06-15", seq: 1 }), "S-20260615");
eq("docNumber contract second", buildDocNumber({ docType: "contract", entityCode: "TIM", date: "2026-06-15", seq: 2 }), "S-20260615-2");
eq("docNumber invoice TWG", buildDocNumber({ docType: "invoice", entityCode: "TWG", date: "2026-06-15", seq: 8 }), "TWG0008");
eq("docNumber proforma", buildDocNumber({ docType: "proforma_invoice", entityCode: "TIM", date: "2026-06-15", seq: 23 }), "AV0023");

// ── VAT ──────────────────────────────────────────────────────────────────────
eq("VAT LV→LV rule", resolveVat({ fromCountry: "LV", toCountry: "LV" }).rule, "domestic_reverse_charge");
eq("VAT LV→LV rate", resolveVat({ fromCountry: "LV", toCountry: "LV" }).rate, 0);
eq("VAT GB→GB rule", resolveVat({ fromCountry: "GB", toCountry: "GB" }).rule, "domestic_standard");
eq("VAT GB→GB rate", resolveVat({ fromCountry: "GB", toCountry: "GB" }).rate, 20);
eq("VAT LV→SE rule", resolveVat({ fromCountry: "LV", toCountry: "SE" }).rule, "intra_eu");
eq("VAT LV→GB rule (export)", resolveVat({ fromCountry: "LV", toCountry: "GB" }).rule, "export");
eq("VAT unknown", resolveVat({ fromCountry: "LV", toCountry: null }).rule, "unknown");

// ── Amount in words ──────────────────────────────────────────────────────────
eq("integerToWords(0)", integerToWords(0), "zero");
eq("integerToWords(1234)", integerToWords(1234), "one thousand two hundred thirty-four");
eq("amountInWords(123450, EUR)", amountInWords(123450, "EUR"), "One thousand two hundred thirty-four euro and 50 cents");
eq("amountInWords(0, GBP)", amountInWords(0, "GBP"), "Zero pounds and 00 pence");

// ── PDF render (Sales Specification) ─────────────────────────────────────────
const fixture: DocumentData = {
  docType: "sales_spec",
  docTitle: "SALES SPECIFICATION",
  docNumber: "Spec No 1",
  docDate: "2026-06-15T09:30:00Z",
  dealCode: "TIMSOM001",
  currency: "EUR",
  seller: {
    name: "Timber International Ltd",
    regNo: "LV40000000000",
    vatNo: "LV40000000000",
    address: "Ulbrokas iela 19A, Riga, LV-1021, Latvia",
    country: "LV",
    email: "sales@timber-international.com",
    phone: "+371 29 233 953",
    bankName: "SEB banka",
    bankAccount: "LV00SEBX0000000000000",
    bankSwift: "UNLALV2X",
  },
  buyer: {
    name: "Somms Wood AB",
    regNo: "SE5560000000",
    vatNo: "SE556000000001",
    address: "Industrigatan 1, Stockholm, Sweden",
    country: "SE",
  },
  externalRefs: [{ label: "Client PO", value: "PO-4412" }],
  incoterms: "FCA Riga",
  paymentTerms: "50% advance, balance before loading",
  deliveryTerms: "Within 4 weeks",
  deliveryDeadline: "July 2026",
  advancePct: 50,
  lineItems: [
    { lineNo: 1, description: "Firewood (malka), Birch, KD", dimensions: "—", pieces: "120", volumeM3: 24.0, unit: "m3", unitPriceCents: 9500, lineTotalCents: 228000 },
    { lineNo: 2, description: "Big bags", dimensions: "—", pieces: "120", volumeM3: null, unit: "package", unitPriceCents: 250, lineTotalCents: 30000 },
  ],
  totals: {
    totalVolumeM3: 24.0,
    subtotalCents: 258000,
    vatRate: 0,
    vatReference: "Intra-Community supply, Art. 138 of Directive 2006/112/EC — 0% VAT.",
    vatCents: 0,
    totalCents: 258000,
    amountInWords: amountInWords(258000, "EUR"),
  },
  notes: "Sample specification generated by the deals MVP test harness.",
};

const rendered = renderSpecification(fixture);
const header = new TextDecoder().decode(rendered.bytes.slice(0, 5));
ok("PDF starts with %PDF-", header === "%PDF-");
ok("PDF is non-trivial size (>1KB)", rendered.bytes.length > 1000);
eq("PDF file name", rendered.fileName, "TIMSOM001 Sales Specification Spec No 1.pdf");

const outPath = "/tmp/sample-sales-specification.pdf";
writeFileSync(outPath, rendered.bytes);
console.log(`\nSample PDF written: ${outPath} (${rendered.bytes.length} bytes)`);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
